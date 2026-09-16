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
|Nguyễn Hữu Chương |2A202602601 | |Thiết kế workflow, tools cho v0 | .\artifacts\system_prompt.md .\artifacts\tools.yaml .\data\eval_group.json .\data\eval_pii_adversarial.json .\data\eval_base.json .\pii_data\access_logs.json .\pii_data\decree_13_knowledge.json .\pii_data\pii_dataset.csv .\pii_data\sample_pii.csv .\tools\audit_data_access\tool.py .\tools\classify_pii_sensitivity\tool.py .\tools\generate_compliance_report\tool.py .\tools\generate_masked_view\tool.py .\tools\propose_masking_policy\tool.py .\tools\scan_dataset_pii\tool.py|

## Nhận xét chung

- Kết quả và bằng chứng:
- Thay đổi hiệu quả nhất:
- Giới hạn còn lại:
- Cách phân công và tích hợp:

## INDIVIDUAL

Sao chép mục này cho từng thành viên.

### Nguyễn Hữu Chương

- **Phần việc và file/commit/PR:**
  - **Công việc đảm nhận:** 
    - Nghiên cứu yêu cầu hệ thống, kiến trúc workflow xử lý dữ liệu và thiết kế quy trình (workflow) cho bài toán AI Agent **phát hiện & che mờ dữ liệu cá nhân (PII Detection & Masking)** 
    - Định nghĩa chi tiết danh sách các **Tools (Tool Calling)**, chuẩn hóa schema (Input/Output/Docstring) và quy định cơ chế phối hợp giữa các tool để hỗ trợ đồng đội thiết kế giao diện (UI) và các kịch bản kiểm thử (Test Cases).
    - Xây dựng file cấu hình hệ thống (`system_prompt.md`, `tools.yaml`) và chuẩn bị bộ dữ liệu mẫu / đánh giá (eval & PII dataset).
  - **Các file đã đóng góp / chỉnh sửa:**
    - **Cấu hình & Artifacts:** [system_prompt.md](file:///starter_v0/artifacts/system_prompt.md), [tools.yaml](file:///starter_v0/artifacts/tools.yaml)
    - **Tools Python (`starter_v0/tools/`):**
      - [scan_dataset_pii/tool.py](file:///starter_v0/tools/scan_dataset_pii/tool.py): Quét và phát hiện các trường PII trong tập dữ liệu.
      - [classify_pii_sensitivity/tool.py](file:///starter_v0/tools/classify_pii_sensitivity/tool.py): Phân loại mức độ nhạy cảm của PII.
      - [propose_masking_policy/tool.py](file:///starter_v0/tools/propose_masking_policy/tool.py): Đề xuất chính sách che mờ dữ liệu phù hợp.
      - [generate_masked_view/tool.py](file:///starter_v0/tools/generate_masked_view/tool.py): Tạo bản hiển thị dữ liệu đã được áp dụng masking.
      - [generate_compliance_report/tool.py](file:///starter_v0/tools/generate_compliance_report/tool.py): Xuất báo cáo tuân thủ bảo mật dữ liệu.
      - [audit_data_access/tool.py](file:///starter_v0/tools/audit_data_access/tool.py): Kiểm tra nhật ký và lịch sử truy cập PII.


- **Quyết định, khó khăn và cách xử lý:**
  - **Quyết định:** Phân tách rõ ràng chức năng của từng Tool  để AI Agent có thể gọi đúng tool theo ngữ cảnh câu hỏi, tránh chồng chéo logic.
  - **Khó khăn:** Định nghĩa chuẩn hóa các tham số và luồng xử lý (workflow) làm sao để vừa tuân thủ Nghị định 13, vừa đủ linh hoạt cho teammates dễ dàng xây dựng giao diện UI cũng như tạo bộ test case chuẩn.
  - **Cách xử lý:** Chủ động làm việc và thảo luận cùng team để chốt quy trình, rà soát lại mô tả tool (docstrings) sao cho LLM hiểu chính xác mục đích gọi tool, đồng thời tinh chỉnh danh sách tool hoàn chỉnh trước khi chuyển giao cho teammates.

- **Điều đã học:**
  - Thiết kế quy trình hoạt động (Workflow) và mô hình Tool Calling cho bài toán thực tế về **AI Agent phát hiện và masking PII**.
  - Cách thiết kế System Prompt và định nghĩa chuẩn hoá các Tool Schema cho Large Language Model.
  - Hiểu sâu hơn về quy định bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) áp dụng vào bài toán công nghệ.

- **AI/công cụ đã dùng và cách kiểm tra:**
  - **Công cụ AI:** Gemini — hỗ trợ phản biện/đánh giá tính hợp lý của workflow, gợi ý mô tả chi tiết docstring cho các tools.
  - **Cách kiểm tra:** Trực tiếp review, tinh chỉnh lại tham số input/output của từng tool, kiểm tra thử luồng chạy và bổ sung thêm các tool còn thiếu để đảm bảo phủ hết các kịch bản sử dụng của hệ thống.

- **Thời điểm đã tự nộp URL repo chung trên VLearn:** Nộp trước 11h59 PM 15/9/2026 trên Vlearn
