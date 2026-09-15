# TEAM — Day04, K4-L3B

**Làm nhóm.** Mỗi người tự viết và commit phần INDIVIDUAL của mình.

## Thông tin bài nộp

- Tên nhóm:
- Người đại diện / MSSV:
- Tên repo: `K4-L3-DAY04-HoVaTen-MSSV-PromptEngineeringToolCalling`
- URL repo, nhánh nộp, commit chốt:
- Deadline áp dụng và link thông báo đổi hạn nếu có:

## Thành viên

| Họ và tên | MSSV | GitHub | Vai trò và công việc | File/commit/PR |
|---|---|---|---|---|
| Phạm Quốc Đạt | 2A202602384 | Chưa cập nhật | Lead Business Analyst (BA) / AI Safety & Evaluation Designer | `docs/BA_REQUIREMENTS.md`, `eval/test_scenarios_52.json`, `tests/validate_ba_scenarios.py` |
| | | | | |

## Nhận xét chung

- Kết quả và bằng chứng:
- Thay đổi hiệu quả nhất:
- Giới hạn còn lại:
- Cách phân công và tích hợp:

## INDIVIDUAL

Sao chép mục này cho từng thành viên.

### Họ và tên — MSSV

- Phần việc và file/commit/PR:
- Quyết định, khó khăn và cách xử lý:
- Điều đã học:
- AI/công cụ đã dùng và cách kiểm tra:
- Thời điểm đã tự nộp URL repo chung trên VLearn:

### Phạm Quốc Đạt — 2A202602384

- **Vai trò:** Lead Business Analyst (BA) / AI Safety & Evaluation Designer.
- **Phần việc và deliverables đã hoàn thành:**
	- [docs/BA_REQUIREMENTS.md](docs/BA_REQUIREMENTS.md): Đặc tả bài toán PrivacyGuard AI theo Nghị định 13/2023/NĐ-CP; thiết kế 5 User Stories từ US-01 đến US-05 với Pre-conditions, Acceptance Criteria, Post-conditions và tool liên quan; mô tả workflow tool-calling kết hợp Human-in-the-loop (HITL), safety state machine và traceability matrix.
	- [eval/test_scenarios_52.json](eval/test_scenarios_52.json): Thiết kế đầy đủ benchmark 52 scenarios gồm 20 Base Single-turn, 10 Base Multi-turn, 12 Adversarial/Safety và 10 Vietnamese Edge Cases.
	- [tests/validate_ba_scenarios.py](tests/validate_ba_scenarios.py): Xây dựng script Python tự động đọc JSON, kiểm tra schema cơ bản, tool hợp lệ, cờ confirmation cho `apply_masking`, tổng số scenarios và phân bổ bốn category.
- **Đóng góp phối hợp:** Tham gia QA cùng AI Engineer để đo lường tỷ lệ lỗi qua các phiên bản v0 đến v3; chuẩn bị 4 kịch bản trình diễn trực tiếp trên Web: normal detection, before/after preview, multi-turn intent retention và safety/adversarial refusal.
- **Quyết định, khó khăn và cách xử lý:** Đặt Human Confirmation Gate trước mọi WRITE action, invalid hóa confirmation khi dataset/column/strategy thay đổi, và kiểm soát Zero Raw PII Exposure trong output, preview và audit report.
- **Điều đã học:** Cần kiểm thử riêng routing tool, trạng thái hội thoại nhiều lượt và ranh giới giữa READ với WRITE; kết quả tool-call chỉ được xem là đạt khi đồng thời đúng tool, đúng scope và đúng điều kiện an toàn.
- **AI/công cụ đã dùng và cách kiểm tra:** Sử dụng GitHub Copilot trong VS Code để hỗ trợ soạn thảo và kiểm tra cấu trúc; tự kiểm tra bằng lệnh `python tests/validate_ba_scenarios.py` và đối chiếu số lượng 52 scenarios theo category.
- **Thời điểm đã tự nộp URL repo chung trên VLearn:** Cập nhật sau khi nhóm chốt URL repo và commit nộp bài.
