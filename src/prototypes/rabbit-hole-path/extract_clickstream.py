"""
Boil a Wikipedia clickstream dump down to "most readers come from / go to".

For every article, keeps the top TOP_N article-to-article links in and out
(type == 'link', at least MIN_N clicks), and writes them as 256 small JSON
shards keyed by FNV-1a(utf-8 title) & 0xff, so the page fetches one shard per
article instead of the whole set.

usage: python3 -I extract_clickstream.py <dump.tsv.gz> <out_dir> [min_n]
"""
import gzip
import heapq
import json
import os
import sys

TOP_N = 1
SKIP = {'Main_Page'}


def fnv1a(title: str) -> int:
    h = 0x811C9DC5
    for b in title.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def push(store, key, n, other):
    heap = store.setdefault(key, [])
    if len(heap) < TOP_N:
        heapq.heappush(heap, (n, other))
    elif n > heap[0][0]:
        heapq.heapreplace(heap, (n, other))


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    min_n = int(sys.argv[3]) if len(sys.argv) > 3 else 100

    came_from = {}  # curr -> top prevs
    went_to = {}  # prev -> top currs
    rows = kept = 0
    with gzip.open(src, 'rt', encoding='utf-8') as f:
        for line in f:
            rows += 1
            parts = line.rstrip('\n').split('\t')
            if len(parts) != 4:
                continue
            prev, curr, kind, n = parts
            if kind != 'link' or prev in SKIP or curr in SKIP:
                continue
            n = int(n)
            if n < min_n:
                continue
            kept += 1
            prev_t = prev.replace('_', ' ')
            curr_t = curr.replace('_', ' ')
            push(came_from, curr_t, n, prev_t)
            push(went_to, prev_t, n, curr_t)

    shards = [dict() for _ in range(256)]
    for title in set(came_from) | set(went_to):
        entry = {}
        if title in came_from:
            entry['in'] = [[t, n] for n, t in sorted(came_from[title], reverse=True)]
        if title in went_to:
            entry['out'] = [[t, n] for n, t in sorted(went_to[title], reverse=True)]
        shards[fnv1a(title) & 0xFF][title] = entry

    os.makedirs(out_dir, exist_ok=True)
    total = 0
    for i, shard in enumerate(shards):
        path = os.path.join(out_dir, f'{i:02x}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(shard, f, ensure_ascii=False, separators=(',', ':'))
        total += os.path.getsize(path)

    print(f'rows={rows} kept={kept} articles={sum(len(s) for s in shards)} bytes={total}')


if __name__ == '__main__':
    main()
