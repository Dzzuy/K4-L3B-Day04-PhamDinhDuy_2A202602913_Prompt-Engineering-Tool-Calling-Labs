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
| Võ Trường An| 2A202602656| AnCoder1310| Full-stack/AI Developer: xây dựng Frontend Next.js, Backend FastAPI; thiết kế và triển khai AI Agent phát hiện PII, masking dữ liệu; tích hợp tool calling và kiểm thử luồng xử lý CSV| web/, starter_v0/privacyguard/, starter_v0/agent.py; các commit/PR liên quan đến PII Guard|

## Nhận xét chung

- Kết quả và bằng chứng:
- Thay đổi hiệu quả nhất:
- Giới hạn còn lại:
- Cách phân công và tích hợp:

## INDIVIDUAL

Sao chép mục này cho từng thành viên.
Võ Trường An — 2A202602656
### Họ và tên — MSSV

- Phần việc và file/commit/PR: Tham gia xây dựng đề tài AI Agent phát hiện & Masking PII phục vụ tuân thủ. Phụ trách phát triển và kiểm tra phần Frontend bằng Next.js, Backend bằng FastAPI; xây dựng luồng upload và xử lý file CSV; nghiên cứu và triển khai luồng AI Agent phát hiện PII, masking dữ liệu và trả về file kết quả. Các phần code liên quan gồm web/, starter_v0/privacyguard/, starter_v0/agent.py và các file cấu hình/chạy hệ thống.
- Quyết định, khó khăn và cách xử lý: Quyết định sử dụng kiến trúc Next.js cho Frontend và FastAPI cho Backend để dễ tách biệt giao diện và logic xử lý dữ liệu. Khó khăn gặp phải gồm lỗi môi trường Python, thiếu package uvicorn và fastapi, lỗi khởi động ASGI app và lỗi kết nối giữa Frontend với Backend. Đã kiểm tra log, xác định đúng entry point privacyguard.api:app, cài đặt dependency trong virtual environment và kiểm tra lại từng thành phần của hệ thống.
- Điều đã học: Hiểu rõ hơn sự khác nhau giữa chatbot và AI Agent, cách Agent sử dụng tool để thực hiện tác vụ thay vì chỉ sinh câu trả lời. Học thêm về Prompt Engineering, Tool Calling, quy trình phát hiện và masking PII, cách tổ chức Frontend–Backend và cách debug lỗi khi tích hợp các thành phần của một hệ thống AI.
- AI/công cụ đã dùng và cách kiểm tra: Sử dụng LLM/AI Agent cho việc phân tích và phát hiện PII; sử dụng các công cụ lập trình như Next.js, FastAPI, Python, Git/GitHub, VS Code và Terminal. Kiểm tra bằng cách chạy Backend trên 127.0.0.1:8000, kiểm tra API/Swagger, chạy Frontend trên localhost:3000, kiểm tra request/response và xem log khi xảy ra lỗi.
- Thời điểm đã tự nộp URL repo chung trên VLearn:
