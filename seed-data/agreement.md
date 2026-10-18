# Độ khớp nhãn tay và nhãn máy (40 cặp CV–tin)

Nhãn tay là đáp án chuẩn; nhãn máy là luật `rule_label` (bản đã bổ sung điều kiện khác vị trí).

## Ma trận nhầm lẫn (hàng: nhãn tay, cột: nhãn máy)

| tay \ máy | suitable | review | unsuitable | Tổng |
|---|---|---|---|---|
| suitable | 6 | 1 | 0 | 7 |
| review | 0 | 7 | 0 | 7 |
| unsuitable | 0 | 1 | 25 | 26 |
| Tổng | 6 | 9 | 25 | 40 |

- Độ khớp 3 lớp: **95.0%** (38/40), Cohen kappa **0.91**
- Tập tune: 26/28; tập test: 12/12
- Gộp hai lớp (đáng xem = suitable + review, so với unsuitable): **39/40 = 97.5%**

## Cặp còn lệch

- P02: tay = suitable, máy = review (tune)
- P19: tay = unsuitable, máy = review (tune)