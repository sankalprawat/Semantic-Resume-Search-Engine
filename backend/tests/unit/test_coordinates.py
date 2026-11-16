from app.utils.coordinates import merge_adjacent_bboxes, normalize_bbox, normalize_coordinate


def test_normalize_coordinate():
    assert normalize_coordinate(0.0, 612.0) == 0.0
    assert normalize_coordinate(612.0, 612.0) == 1.0
    assert normalize_coordinate(306.0, 612.0) == 0.5
    # Clamping test: coordinates outside bounds should clamp to [0.0, 1.0]
    assert normalize_coordinate(-10.0, 612.0) == 0.0
    assert normalize_coordinate(700.0, 612.0) == 1.0
    assert normalize_coordinate(50.0, 0.0) == 0.0


def test_normalize_bbox():
    bbox = normalize_bbox(
        x0=100.0,
        y0=200.0,
        x1=300.0,
        y1=250.0,
        page_width=600.0,
        page_height=1000.0,
    )
    assert bbox["x0"] == round(100.0 / 600.0, 5)
    assert bbox["y0"] == round(200.0 / 1000.0, 5)
    assert bbox["x1"] == round(300.0 / 600.0, 5)
    assert bbox["y1"] == round(250.0 / 1000.0, 5)
    assert bbox["x0"] <= bbox["x1"]
    assert bbox["y0"] <= bbox["y1"]


def test_merge_adjacent_bboxes():
    # Two words on the same horizontal line (line 1)
    word1 = {"x0": 0.1, "y0": 0.2, "x1": 0.2, "y1": 0.22}
    word2 = {"x0": 0.22, "y0": 0.2, "x1": 0.35, "y1": 0.22}
    # One word on a subsequent line (line 2)
    word3 = {"x0": 0.1, "y0": 0.3, "x1": 0.4, "y1": 0.32}

    merged = merge_adjacent_bboxes([word1, word2, word3])
    assert len(merged) == 2

    # First merged box should span from word1.x0 to word2.x1
    assert merged[0]["x0"] == 0.1
    assert merged[0]["x1"] == 0.35
    assert merged[0]["y0"] == 0.2

    # Second box remains untouched
    assert merged[1]["x0"] == 0.1
    assert merged[1]["x1"] == 0.4
    assert merged[1]["y0"] == 0.3
