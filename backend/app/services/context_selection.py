from collections import OrderedDict
from typing import Dict, List


def select_representative_chunks(chunks: List[dict], limit: int) -> List[dict]:
    """Select chunks across documents and across each document's full length."""
    if limit <= 0 or not chunks:
        return []
    if len(chunks) <= limit:
        return list(chunks)

    grouped: Dict[str, List[dict]] = OrderedDict()
    for index, chunk in enumerate(chunks):
        # Preserve separate groups if a row has no document ID.
        key = str(chunk.get("document_id") or f"__chunk_{index}")
        grouped.setdefault(key, []).append(chunk)

    keys = list(grouped)
    if limit < len(keys):
        positions = [round(i * (len(keys) - 1) / max(1, limit - 1)) for i in range(limit)]
        keys = [keys[position] for position in positions]

    quotas = {key: 0 for key in keys}
    remaining = min(limit, sum(len(grouped[key]) for key in keys))
    while remaining:
        progressed = False
        for key in keys:
            if quotas[key] < len(grouped[key]):
                quotas[key] += 1
                remaining -= 1
                progressed = True
                if remaining == 0:
                    break
        if not progressed:
            break

    per_document: Dict[str, List[dict]] = {}
    for key in keys:
        group = grouped[key]
        quota = quotas[key]
        if quota == 1:
            indexes = [len(group) // 2]
        else:
            indexes = [round(i * (len(group) - 1) / (quota - 1)) for i in range(quota)]
        per_document[key] = [group[index] for index in indexes]

    # Interleave documents so one source does not dominate the beginning of the prompt.
    selected: List[dict] = []
    max_quota = max(quotas.values(), default=0)
    for round_index in range(max_quota):
        for key in keys:
            if round_index < len(per_document[key]):
                selected.append(per_document[key][round_index])
    return selected
