from typing import Any


def normalize_coordinate(val: float, max_val: float) -> float:
    """
    Normalize a point coordinate (x or y) to a relative ratio [0.0, 1.0].
    Clamps between 0.0 and 1.0 to guard against minor floating-point or boundary overflow.
    """
    if max_val <= 0:
        return 0.0
    ratio = val / max_val
    return round(max(0.0, min(1.0, ratio)), 5)


def normalize_bbox(
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    page_width: float,
    page_height: float,
) -> dict[str, float]:
    """
    Transform raw PyMuPDF bounding box points (72 DPI) into resolution-independent
    normalized coordinates [0.0, 1.0] relative to page width and height.

    Formula:
        x_norm = x / page_width
        y_norm = y / page_height
    """
    norm_x0 = normalize_coordinate(x0, page_width)
    norm_y0 = normalize_coordinate(y0, page_height)
    norm_x1 = normalize_coordinate(x1, page_width)
    norm_y1 = normalize_coordinate(y1, page_height)

    # Ensure min < max
    return {
        "x0": min(norm_x0, norm_x1),
        "y0": min(norm_y0, norm_y1),
        "x1": max(norm_x0, norm_x1),
        "y1": max(norm_y0, norm_y1),
    }


def merge_adjacent_bboxes(
    bboxes: list[dict[str, Any]],
    line_y_tolerance: float = 0.008,
    x_gap_tolerance: float = 0.04,
) -> list[dict[str, float]]:
    """
    Merges adjacent bounding boxes that belong to the same text line into a single
    continuous rectangular box.

    Why this optimization is critical:
    PyMuPDF extracts words individually, resulting in 40-60 bounding boxes per sentence.
    This function coalesces adjacent word boxes on the same horizontal line into 1-2
    cohesive line-level highlights, reducing JSON payload size by ~80% and preventing
    jagged, fragmented highlight rendering in the PDF.js frontend canvas.
    """
    if not bboxes:
        return []

    # Sort primarily by vertical position (y0), then horizontal position (x0)
    sorted_boxes = sorted(bboxes, key=lambda b: (b["y0"], b["x0"]))
    merged: list[dict[str, float]] = []

    current = dict(sorted_boxes[0])

    for nxt in sorted_boxes[1:]:
        same_line = (
            abs(nxt["y0"] - current["y0"]) <= line_y_tolerance
            and abs(nxt["y1"] - current["y1"]) <= line_y_tolerance
        )
        adjacent_x = nxt["x0"] <= (current["x1"] + x_gap_tolerance)

        if same_line and adjacent_x:
            # Expand current box horizontally to cover the next word
            current["x1"] = max(current["x1"], nxt["x1"])
            current["y0"] = min(current["y0"], nxt["y0"])
            current["y1"] = max(current["y1"], nxt["y1"])
        else:
            merged.append(current)
            current = dict(nxt)

    merged.append(current)
    return merged
