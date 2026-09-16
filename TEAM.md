# TEAM — Day04, K4-L3B

**Làm nhóm.** Mỗi người tự viết và commit phần INDIVIDUAL của mình.

## Thông tin bài nộp

- Tên nhóm: PhamDinhDuy_2A202602913
- Người đại diện / MSSV: Phạm Đình Duy - 2A202602913
- Tên repo: `K4-L3-DAY04-HoVaTen-MSSV-PromptEngineeringToolCalling`
- URL repo, nhánh nộp, commit chốt:
- Deadline áp dụng và link thông báo đổi hạn nếu có:

## Thành viên

| Họ và tên     | MSSV        | GitHub        | Vai trò và công việc                                         | File/commit/PR                                                                             |
| ---------------| -------------| ---------------| --------------------------------------------------------------| --------------------------------------------------------------------------------------------|
| Phạm Quốc Đạt | 2A202602384 | Chưa cập nhật | Lead Business Analyst (BA) / AI Safety & Evaluation Designer | `docs/BA_REQUIREMENTS.md`, `eval/test_scenarios_52.json`, `tests/validate_ba_scenarios.py` |
| Phạm Đình Duy | 2A202602913 | Dzzuy | Team Leader/ AI Engineer / Agent Integration & Evaluation | agent/tool integration, `starter_v0/run_pii_eval.py`, PrivacyGuard tool runtime and evaluation |
|               |             |               |                                                              |                                                                                            |

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

### Phạm Đình Duy — 2A202602913

- **Vai trò:** AI Engineer / Agent Integration & Evaluation.
- **Phần việc và file/commit/PR:**
  - Phối hợp kiểm tra và ổn định PrivacyGuard AI v0 để agent có thể import và sử dụng đủ contract 8 tools.
  - `starter_v0/tools/search_legal_compliance/tool.py`: bổ sung implementation còn thiếu cho `search_legal_compliance`, dùng local `decree_13_knowledge.json` và keyword matching đơn giản để giữ đúng phạm vi baseline v0.
  - `starter_v0/artifacts/system_prompt.md`: sửa wording còn sót từ IT Helpdesk sang domain PII/privacy mà không tối ưu routing sớm.
  - `starter_v0/run_pii_eval.py`: bổ sung evaluator dành cho bộ PrivacyGuard scenarios, hỗ trợ single-turn, multi-turn, adversarial evaluation và lưu metrics/run evidence.
  - Kiểm tra integration giữa `tools.yaml`, `TOOL_FUNCTIONS`, tool implementations và bộ 52 scenarios.
  - Hoàn thành và freeze v0 baseline bằng Groq model `openai/gpt-oss-20b`; run evidence: `starter_v0/runs/v0_privacyguard_groq_20260916T092840896612.json`.
  - Metrics v0: 52/52 measured cases, `provider_error_cases=0`, 19 passed cases, case accuracy `0.3654`, tool routing accuracy `0.6832`, argument accuracy `0.4851`, multiturn accuracy `0.0`; adversarial pass `6/12`.
  - Commit: cập nhật sau khi commit phần v0.
- **Quyết định, khó khăn và cách xử lý:**
  - Phát hiện v0 đã có phần lớn PII tools và scenarios nhưng chưa thể xem là baseline hoàn chỉnh do thiếu implementation của `search_legal_compliance` và evaluator PII chưa được nối với runtime.
  - Chọn cách sửa tối thiểu để v0 chỉ trở thành baseline có thể chạy và đo lường, thay vì tối ưu toàn bộ hệ thống ngay từ đầu.
  - Cố ý giữ lại một số hạn chế của v0 như detector dựa nhiều vào tên cột, HITL chưa enforce mạnh ở tool layer và masked SQL còn đơn giản để các phiên bản v1-v3 có cải tiến đo được.
  - Bộ 52 scenarios được giữ cố định; không sửa expected result chỉ để tăng điểm v0.
  - v0 được cố ý giữ weak baseline để v1-v3 có không gian cải tiến routing, multi-turn/HITL và safety; không tự tạo hoặc ghi metric giả.
- **Điều đã học:**
  - Một agent có file tool chưa có nghĩa là toàn bộ workflow đã hoạt động; cần kiểm tra declaration, registry, implementation, evaluator và runtime cùng nhau.
  - Baseline cần đủ yếu để thể hiện improvement nhưng vẫn phải chạy được và đo được.
  - Khi làm iterative agent engineering, nên thay đổi có kiểm soát giữa các version để biết chính xác cải tiến nào ảnh hưởng đến routing, argument accuracy, multi-turn hay safety.
  - Evaluation evidence quan trọng hơn việc chỉ demo agent chạy được.
- **AI/công cụ đã dùng và cách kiểm tra:**
  - Sử dụng ChatGPT để audit kiến trúc/repository, brainstorm version strategy và kiểm tra sự nhất quán giữa topic, tools, eval và workflow.
  - Sử dụng Codex để hỗ trợ implementation và validation của v0 theo task specification đã giới hạn scope.
  - Kiểm tra bằng:
    - `python3 -m compileall -q starter_v0`
    - `python3 tests/validate_ba_scenarios.py`
    - import/smoke test `TOOL_FUNCTIONS`
    - deterministic smoke tests cho 8 tools
    - live run `starter_v0/run_pii_eval.py` với Groq `openai/gpt-oss-20b`
  - Validator hiện xác nhận 52 scenarios: 20 base single-turn, 10 base multi-turn, 12 adversarial và 10 edge-domain.
  - Live provider evaluation đã hoàn tất với `provider_error_cases == 0`; v0 baseline được freeze theo run evidence đã ghi.
- **Thời điểm đã tự nộp URL repo chung trên VLearn:** Cập nhật sau khi nhóm chốt bản nộp.
