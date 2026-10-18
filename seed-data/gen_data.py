#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sinh bộ dữ liệu mẫu cho Job Board (Bước 0 của phần AI).
Chạy lại luôn ra đúng cùng một kết quả vì seed cố định.

Lưu ý: toàn bộ công ty, tin tuyển dụng và CV đều là dữ liệu TỔNG HỢP (hư cấu).
Nhãn của truy vấn và của cặp CV-tin được gán bằng quy tắc dựa trên thuộc tính lúc sinh,
nên chỉ là nhãn "bạc", cần người kiểm tra lại một phần (xem README).
"""
import csv
import datetime
import json
import os
import random
import unicodedata
from collections import Counter

SEED = 20261015
rnd = random.Random(SEED)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")
os.makedirs(OUT, exist_ok=True)

LEVELS = ["intern", "junior", "middle", "senior"]
LEVEL_IDX = {l: i for i, l in enumerate(LEVELS)}
LEVEL_WEIGHTS = [0.15, 0.30, 0.35, 0.20]

HCM, HN, DN, HP, CT = "TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Hải Phòng", "Cần Thơ"
PROV_SHORT = {HCM: "HCM", HN: "HN", DN: "ĐN", HP: "HP", CT: "CT"}
PROVINCE_COMPANY_COUNTS = [(HCM, 9), (HN, 7), (DN, 4), (HP, 2), (CT, 2)]
JOB_PROVINCE_WEIGHTS = [(HCM, .38), (HN, .30), (DN, .14), (HP, .10), (CT, .08)]

# ---------------------------------------------------------------- kỹ năng
ALIASES = {
    "NestJS": ["Nest.js"], "Node.js": ["NodeJS", "Node"], "TypeScript": ["TS"], "JavaScript": ["JS"],
    "PostgreSQL": ["Postgres"], "React": ["ReactJS", "React.js"], "Vue.js": ["VueJS", "Vue"],
    "Kubernetes": ["k8s"], "MongoDB": ["Mongo"], "Spring Boot": ["Spring"], ".NET": ["dotnet", ".NET Core"],
    "CI/CD": ["CI CD"], "Agile/Scrum": ["Scrum", "Agile"], "Machine Learning": ["ML"],
    "Power BI": ["PowerBI"], "HTML/CSS": ["HTML5/CSS3"], "Next.js": ["NextJS"],
    "Tailwind CSS": ["Tailwind"], "REST API": ["RESTful API"], "GitHub Actions": ["GH Actions"],
    "Unit test": ["Unit Testing"], "Test case": ["Testcase"], "User Story": ["user stories"],
}

# ---------------------------------------------------------------- vị trí
ROLES = {
    "backend_nestjs": dict(
        n=30, family="backend",
        vi=["Lập trình viên Backend NestJS"], en=["Backend Developer (NestJS)", "Node.js Backend Engineer"],
        core=["NestJS", "TypeScript", "Node.js"],
        extra=["PostgreSQL", "Redis", "Docker", "REST API", "RabbitMQ", "Microservices", "Git", "Jest", "MongoDB", "GraphQL", "Elasticsearch"],
        focus_en="RESTful APIs and backend services using NestJS",
        duties=[
            "Thiết kế và phát triển REST API bằng NestJS cho các sản phẩm của công ty",
            "Xây dựng module, service và cơ chế phân quyền người dùng bằng guard và interceptor",
            "Thiết kế cơ sở dữ liệu, viết truy vấn và tối ưu hiệu năng cho các API có nhiều người dùng",
            "Viết unit test, e2e test và tham gia review code trong nhóm",
            "Tích hợp hàng đợi, gửi email và các dịch vụ bên thứ ba như cổng thanh toán",
            "Phối hợp với frontend và tester để hoàn thiện tính năng đúng tiến độ",
            "Theo dõi log, xử lý lỗi và giữ cho hệ thống chạy ổn định trên môi trường thật",
        ]),
    "backend_java": dict(
        n=24, family="backend",
        vi=["Lập trình viên Java Spring Boot"], en=["Java Backend Developer", "Java Spring Developer"],
        core=["Java", "Spring Boot"],
        extra=["MySQL", "PostgreSQL", "Kafka", "Docker", "Kubernetes", "Microservices", "Redis", "REST API", "Git"],
        focus_en="backend services using Java and Spring Boot",
        duties=[
            "Phát triển các dịch vụ backend bằng Java và Spring Boot",
            "Thiết kế API và tích hợp với hệ thống của đối tác",
            "Tối ưu truy vấn và xử lý giao dịch với khối lượng dữ liệu lớn",
            "Viết tài liệu kỹ thuật và test tự động cho các module phụ trách",
            "Tham gia thiết kế kiến trúc microservices, đảm bảo khả năng mở rộng",
            "Hỗ trợ xử lý sự cố trên môi trường vận hành",
        ]),
    "backend_dotnet": dict(
        n=18, family="backend",
        vi=["Lập trình viên .NET"], en=[".NET Developer", "C# Backend Developer"],
        core=["C#", ".NET"],
        extra=["SQL Server", "Docker", "REST API", "Redis", "Microservices", "Git", "RabbitMQ"],
        focus_en="web APIs using C# and .NET",
        duties=[
            "Phát triển và bảo trì ứng dụng web API bằng C# và .NET",
            "Thiết kế cơ sở dữ liệu SQL Server, viết stored procedure và tối ưu truy vấn",
            "Xây dựng các chức năng nghiệp vụ theo tài liệu yêu cầu của khách hàng",
            "Viết unit test và sửa lỗi do tester báo",
            "Tham gia họp phân tích yêu cầu và ước lượng thời gian thực hiện",
            "Triển khai ứng dụng lên máy chủ và hỗ trợ khách hàng khi có sự cố",
        ]),
    "backend_python": dict(
        n=20, family="backend",
        vi=["Lập trình viên Backend Python"], en=["Python Backend Developer", "Python Developer"],
        core=["Python", ["FastAPI", "Django"]],
        extra=["PostgreSQL", "Docker", "Redis", "REST API", "Git", "Unit test", "RabbitMQ", "MongoDB"],
        focus_en="APIs and background services in Python",
        duties=[
            "Xây dựng các API và dịch vụ xử lý nền bằng Python",
            "Thiết kế mô hình dữ liệu và viết truy vấn cho các chức năng của hệ thống",
            "Viết script tự động hóa tác vụ lặp lại và xử lý dữ liệu đầu vào",
            "Đóng gói ứng dụng bằng Docker và phối hợp triển khai",
            "Viết test và tài liệu cho các endpoint đã xây dựng",
            "Trao đổi với nhóm frontend để thống nhất định dạng dữ liệu trả về",
        ]),
    "frontend_react": dict(
        n=26, family="frontend",
        vi=["Lập trình viên Frontend ReactJS"], en=["React Frontend Developer", "Frontend Engineer (React)"],
        core=["React", ["TypeScript", "JavaScript"]],
        extra=["Next.js", "HTML/CSS", "Tailwind CSS", "Git", "REST API", "Jest", "GraphQL"],
        focus_en="responsive web interfaces with React",
        duties=[
            "Xây dựng giao diện web bằng React theo bản thiết kế của nhóm UI/UX",
            "Kết nối giao diện với API backend và xử lý trạng thái ứng dụng",
            "Tối ưu tốc độ tải trang và trải nghiệm trên nhiều kích thước màn hình",
            "Viết component dùng lại được và test giao diện",
            "Phối hợp với backend để thống nhất hợp đồng API",
            "Sửa lỗi hiển thị trên các trình duyệt khác nhau",
        ]),
    "frontend_vue": dict(
        n=14, family="frontend",
        vi=["Lập trình viên Frontend VueJS"], en=["Vue.js Frontend Developer", "Frontend Developer (Vue)"],
        core=["Vue.js", "JavaScript"],
        extra=["TypeScript", "HTML/CSS", "Tailwind CSS", "Git", "REST API", "Jest"],
        focus_en="web interfaces with Vue.js",
        duties=[
            "Phát triển giao diện web bằng Vue.js cho hệ thống quản trị và trang người dùng",
            "Tích hợp API, xử lý form, bảng dữ liệu và biểu đồ",
            "Chuẩn hóa cấu trúc component và code style trong dự án",
            "Tối ưu hiệu năng và khả năng hiển thị trên điện thoại",
            "Trao đổi với designer để hiện thực đúng thiết kế",
            "Viết test và sửa lỗi trước mỗi đợt phát hành",
        ]),
    "fullstack": dict(
        n=16, family="fullstack",
        vi=["Lập trình viên Fullstack"], en=["Fullstack Developer (React, Node.js)", "Fullstack Engineer"],
        core=["React", "Node.js"],
        extra=["NestJS", "TypeScript", "PostgreSQL", "MongoDB", "Docker", "Git", "REST API", "Redis"],
        focus_en="features end to end, from the user interface to the database",
        duties=[
            "Phát triển tính năng từ giao diện đến API và cơ sở dữ liệu",
            "Xây dựng giao diện bằng React và dịch vụ phía máy chủ bằng Node.js",
            "Thiết kế bảng dữ liệu và viết truy vấn cho các chức năng mới",
            "Triển khai ứng dụng bằng Docker và theo dõi lỗi sau khi phát hành",
            "Làm việc trực tiếp với product owner để làm rõ yêu cầu",
            "Viết test và tham gia review code",
        ]),
    "mobile_flutter": dict(
        n=18, family="mobile",
        vi=["Lập trình viên ứng dụng di động Flutter"], en=["Flutter Developer", "Mobile Developer (Flutter)"],
        core=["Flutter", "Dart"],
        extra=["REST API", "Git", "Firebase", "CI/CD", "Unit test"],
        focus_en="cross-platform mobile apps with Flutter",
        duties=[
            "Phát triển ứng dụng di động đa nền tảng bằng Flutter",
            "Kết nối ứng dụng với API và xử lý lưu trữ dữ liệu trên thiết bị",
            "Xây dựng giao diện mượt trên cả Android và iOS theo thiết kế",
            "Đẩy ứng dụng lên App Store và Google Play, theo dõi lỗi sau phát hành",
            "Tích hợp thông báo đẩy, đăng nhập và thanh toán trong ứng dụng",
            "Viết test và phối hợp với backend sửa lỗi",
        ]),
    "mobile_android": dict(
        n=14, family="mobile",
        vi=["Lập trình viên Android"], en=["Android Developer", "Kotlin Android Engineer"],
        core=["Kotlin", "Android"],
        extra=["REST API", "Git", "Firebase", "Unit test", "CI/CD"],
        focus_en="Android applications in Kotlin",
        duties=[
            "Phát triển ứng dụng Android bằng Kotlin",
            "Tích hợp API, lưu trữ cục bộ và thông báo đẩy",
            "Tối ưu hiệu năng, mức tiêu thụ pin và độ ổn định của ứng dụng",
            "Cải thiện giao diện theo hướng dẫn thiết kế Material",
            "Viết test và sửa lỗi trên nhiều dòng máy",
            "Phối hợp với backend và designer trong mỗi sprint",
        ]),
    "data_engineer": dict(
        n=16, family="data",
        vi=["Kỹ sư dữ liệu"], en=["Data Engineer", "ETL Developer"],
        core=["Python", "SQL", "ETL"],
        extra=["Airflow", "Spark", "Kafka", "PostgreSQL", "Docker", "AWS", "Elasticsearch", "Git"],
        focus_en="data pipelines and ETL jobs",
        duties=[
            "Xây dựng và vận hành các luồng ETL đưa dữ liệu từ nhiều nguồn về kho dữ liệu",
            "Thiết kế mô hình dữ liệu và tối ưu truy vấn trên khối lượng dữ liệu lớn",
            "Viết job xử lý dữ liệu theo lô và theo thời gian thực",
            "Giám sát chất lượng dữ liệu và cảnh báo khi luồng dữ liệu bị lỗi",
            "Phối hợp với nhóm phân tích để cung cấp dữ liệu sạch, đúng hạn",
            "Tài liệu hóa các bảng dữ liệu và luồng xử lý",
        ]),
    "data_analyst": dict(
        n=18, family="data",
        vi=["Chuyên viên phân tích dữ liệu"], en=["Data Analyst", "BI Analyst"],
        core=["SQL", "Excel", ["Power BI", "Tableau"]],
        extra=["Python", "Pandas", "Git"],
        focus_en="reports and dashboards from business data",
        duties=[
            "Thu thập, làm sạch và phân tích dữ liệu bán hàng và vận hành",
            "Xây dựng báo cáo và dashboard cho các phòng ban",
            "Viết truy vấn SQL để trả lời các câu hỏi kinh doanh",
            "Theo dõi các chỉ số chính và đề xuất hướng cải thiện",
            "Trình bày kết quả phân tích cho quản lý",
            "Phối hợp với đội kỹ thuật để chuẩn hóa nguồn dữ liệu",
        ]),
    "ml_engineer": dict(
        n=12, family="data",
        vi=["Kỹ sư học máy"], en=["Machine Learning Engineer", "AI Engineer"],
        core=["Python", "Machine Learning"],
        extra=["PyTorch", "scikit-learn", "NLP", "Pandas", "Docker", "FastAPI", "Git", "AWS"],
        focus_en="machine learning models and their integration into products",
        duties=[
            "Xây dựng và huấn luyện mô hình học máy cho bài toán phân loại và gợi ý",
            "Chuẩn bị dữ liệu, gán nhãn và đánh giá mô hình bằng các chỉ số phù hợp",
            "Đưa mô hình vào hệ thống thật qua API và theo dõi chất lượng sau triển khai",
            "Thử nghiệm các mô hình ngôn ngữ và tìm kiếm theo ngữ nghĩa",
            "Viết báo cáo thử nghiệm và so sánh các phương án",
            "Phối hợp với backend để tích hợp mô hình",
        ]),
    "qa": dict(
        n=24, family="qa",
        vi=["Kiểm thử phần mềm", "Chuyên viên kiểm thử (Tester)"], en=["QA Engineer", "QA Tester"],
        core=["Test case", "Postman"],
        extra=["Selenium", "Cypress", "Playwright", "JMeter", "Jira", "SQL", "Git"],
        focus_en="test cases and automated tests",
        duties=[
            "Đọc yêu cầu, viết test case và thực hiện kiểm thử chức năng cho sản phẩm",
            "Báo lỗi rõ ràng trên Jira và theo dõi đến khi lỗi được sửa",
            "Kiểm thử API bằng Postman và kiểm thử hồi quy trước mỗi đợt phát hành",
            "Viết kịch bản kiểm thử tự động cho các luồng quan trọng",
            "Đánh giá hiệu năng cơ bản của hệ thống khi có nhiều người dùng",
            "Phối hợp với lập trình viên để tái hiện và xác nhận lỗi",
        ]),
    "devops": dict(
        n=22, family="devops",
        vi=["Kỹ sư DevOps"], en=["DevOps Engineer", "Cloud/DevOps Engineer"],
        core=["Docker", "Linux", "CI/CD"],
        extra=["Kubernetes", "GitHub Actions", "Jenkins", "AWS", "Terraform", "Git", "Redis"],
        focus_en="CI/CD pipelines and cloud infrastructure",
        duties=[
            "Xây dựng và duy trì quy trình CI/CD để tự động build, test và triển khai",
            "Đóng gói ứng dụng bằng Docker và quản lý môi trường chạy",
            "Thiết lập giám sát, ghi log và cảnh báo để phát hiện sự cố sớm",
            "Quản lý hạ tầng trên cloud và tối ưu chi phí",
            "Xử lý sự cố trên môi trường vận hành và viết quy trình khắc phục",
            "Hỗ trợ nhóm phát triển về môi trường và bảo mật cơ bản",
        ]),
    "ba": dict(
        n=14, family="ba",
        vi=["Chuyên viên phân tích nghiệp vụ"], en=["Business Analyst", "IT Business Analyst"],
        core=["UML", "User Story", "Jira"],
        extra=["SQL", "Agile/Scrum", "Figma", "Excel"],
        focus_en="requirements between clients and the development team",
        duties=[
            "Làm việc với khách hàng và các bên liên quan để thu thập và làm rõ yêu cầu",
            "Viết tài liệu yêu cầu, user story và tiêu chí nghiệm thu",
            "Vẽ sơ đồ luồng nghiệp vụ và mô hình dữ liệu ở mức khái quát",
            "Làm cầu nối giữa khách hàng và đội phát triển trong từng sprint",
            "Tham gia kiểm tra sản phẩm trước khi bàn giao",
            "Theo dõi tiến độ và cập nhật thay đổi yêu cầu",
        ]),
    "ui_ux": dict(
        n=14, family="uiux",
        vi=["Chuyên viên thiết kế UI/UX"], en=["UI/UX Designer", "Product Designer"],
        core=["Figma", "Wireframe", "Design System"],
        extra=["Adobe XD", "HTML/CSS", "Jira", "Agile/Scrum"],
        focus_en="user flows, wireframes and interfaces in Figma",
        duties=[
            "Nghiên cứu người dùng và đề xuất luồng trải nghiệm cho sản phẩm",
            "Thiết kế wireframe, prototype và giao diện hoàn chỉnh bằng Figma",
            "Xây dựng và duy trì design system dùng chung cho các sản phẩm",
            "Phối hợp với lập trình viên để bàn giao thiết kế và kiểm tra kết quả",
            "Thu thập phản hồi từ người dùng để cải thiện giao diện",
            "Trình bày ý tưởng thiết kế với nhóm sản phẩm",
        ]),
}
assert sum(r["n"] for r in ROLES.values()) == 300

LEVEL_VI = {
    "intern": {
        "explicit": [
            "Sinh viên năm 3, năm 4 ngành CNTT hoặc liên quan, có thể thực tập tối thiểu 3 tháng",
            "Thực tập sinh không yêu cầu kinh nghiệm, được mentor kèm cặp",
            "Ưu tiên bạn có đồ án hoặc project cá nhân trên GitHub",
        ],
        "soft": [
            "Phù hợp với bạn sắp ra trường hoặc đang tìm cơ hội đầu tiên trong ngành",
            "Chưa cần kinh nghiệm đi làm, công ty đào tạo từ đầu",
            "Dành cho các bạn sinh viên muốn làm quen với môi trường dự án thật",
        ]},
    "junior": {
        "explicit": [
            "Có 1-2 năm kinh nghiệm ở vị trí tương đương hoặc vừa tốt nghiệp có project thực tế",
            "Junior hoặc fresher đều được xem xét, có nền tảng kiến thức vững",
            "Có ít nhất một project hoàn chỉnh, hiểu quy trình làm việc nhóm",
        ],
        "soft": [
            "Bạn mới ra trường, đã làm quen với dự án thực tế qua đồ án hoặc thực tập",
            "Chấp nhận ứng viên chưa có nhiều kinh nghiệm, sẵn sàng học nhanh",
            "Phù hợp người mới đi làm, được hướng dẫn trong những tháng đầu",
        ]},
    "middle": {
        "explicit": [
            "Có 2-4 năm kinh nghiệm ở vị trí tương đương",
            "Từng làm việc độc lập trên dự án thực tế và chịu trách nhiệm một mảng chức năng",
        ],
        "soft": [
            "Đã đi làm vài năm, tự chủ được công việc mà không cần kèm cặp nhiều",
            "Có kinh nghiệm thực chiến qua một vài dự án, có thể hướng dẫn bạn mới",
        ]},
    "senior": {
        "explicit": [
            "Từ 5 năm kinh nghiệm trở lên",
            "Có kinh nghiệm thiết kế kiến trúc hệ thống và dẫn dắt nhóm nhỏ",
            "Có khả năng review code và hướng dẫn thành viên mới",
        ],
        "soft": [
            "Cần người dày dạn kinh nghiệm, đã từng dẫn dắt đội nhóm kỹ thuật",
            "Ưu tiên ứng viên đã làm nhiều năm, đủ sức đưa ra quyết định kỹ thuật và định hướng cho nhóm",
        ]},
}
LEVEL_EN = {
    "intern": "Final-year student or fresh graduate, no experience required",
    "junior": "0-2 years of experience, fresh graduates are welcome",
    "middle": "2-4 years of experience in a similar role",
    "senior": "5+ years of experience, able to lead a small team and mentor juniors",
}
LEVEL_SLOPPY = {
    "intern": ["sv năm cuối cũng được", "chưa có kinh nghiệm cũng nhận, có mentor"],
    "junior": ["fresher ok, có mentor kèm", "1 năm kinh nghiệm là được"],
    "middle": ["yêu cầu 2-3 năm kinh nghiệm", "cần người làm độc lập được"],
    "senior": ["từ 5 năm kinh nghiệm trở lên, dẫn dắt được nhóm", "cần bạn senior, lead được team"],
}
LEVEL_SLOPPY_SOFT = {
    "intern": ["mới ra trường cũng nhận, đào tạo từ đầu", "sinh viên sắp ra trường ok"],
    "junior": ["bạn mới đi làm cũng được, có người hướng dẫn", "chưa nhiều kinh nghiệm cũng ok, học nhanh là được"],
    "middle": ["đi làm vài năm rồi, tự chủ công việc", "có kinh nghiệm thực tế vài dự án"],
    "senior": ["cần người dày dạn kinh nghiệm, từng dẫn nhóm", "người nhiều năm kinh nghiệm, định hướng được team"],
}

GENERIC_REQ = [
    "Kỹ năng làm việc nhóm tốt, chủ động trong giao tiếp",
    "Có tư duy giải quyết vấn đề và tinh thần học hỏi",
    "Đọc hiểu tài liệu tiếng Anh chuyên ngành",
    "Cẩn thận, có trách nhiệm với công việc được giao",
]
BENEFITS_VI = [
    "Lương tháng 13 và thưởng theo hiệu quả dự án",
    "Bảo hiểm xã hội, y tế đầy đủ theo quy định",
    "Khám sức khỏe định kỳ hằng năm",
    "Được cấp laptop và thiết bị làm việc",
    "Xét tăng lương hai lần mỗi năm",
    "Du lịch công ty và team building hằng năm",
    "Ngân sách đào tạo và thi chứng chỉ",
    "12 ngày phép mỗi năm",
    "Môi trường trẻ, thân thiện, ít họp",
    "Hỗ trợ ăn trưa và gửi xe",
]
BENEFITS_EN = [
    "Competitive salary and 13th month bonus",
    "Full social and health insurance",
    "Annual health check-up and company trip",
    "Laptop and equipment provided",
    "Salary review twice a year",
    "Training budget and certification support",
    "Young, friendly team with few meetings",
]
CULTURE_VI = [
    "Chúng tôi coi trọng việc viết code dễ đọc, có test và có người review. Mỗi tuần nhóm họp ngắn một lần để chia sẻ tiến độ và vướng mắc, không họp dàn trải.",
    "Nhóm làm việc theo sprint hai tuần, có buổi nhìn lại sau mỗi sprint để cải thiện quy trình. Thành viên mới được ghép với một anh chị hướng dẫn trong ba tháng đầu.",
    "Công ty khuyến khích chia sẻ kiến thức nội bộ: mỗi tháng có một buổi trình bày kỹ thuật do chính các thành viên đảm nhận.",
]
REMOTE_VI = {
    "full": ["Hình thức làm việc: remote hoàn toàn, không bắt buộc đến văn phòng",
             "Được làm việc tại nhà toàn thời gian, chỉ họp trực tiếp khi thật sự cần thiết"],
    "hybrid": ["Làm việc kiểu hybrid, 2 ngày mỗi tuần tại văn phòng"],
}
REMOTE_EN = {"full": "Fully remote position, no office attendance required",
             "hybrid": "Hybrid schedule, 2 days per week in the office"}

DOMAINS = {
    "fintech": dict(
        vp="phát triển nền tảng thanh toán điện tử và sản phẩm tài chính số cho ngân hàng",
        np="ngân hàng số và thanh toán điện tử", en="digital banking and online payments"),
    "thương mại điện tử": dict(
        vp="xây dựng sàn thương mại điện tử và công cụ bán hàng đa kênh",
        np="thương mại điện tử và bán lẻ trực tuyến", en="e-commerce and online retail"),
    "y tế": dict(
        vp="làm phần mềm quản lý bệnh viện, phòng khám và hồ sơ sức khỏe điện tử",
        np="công nghệ y tế", en="healthcare software"),
    "giáo dục": dict(
        vp="phát triển nền tảng học trực tuyến và phần mềm quản lý trường học",
        np="công nghệ giáo dục", en="online education platforms"),
    "logistics": dict(
        vp="xây dựng hệ thống quản lý vận chuyển, kho bãi và giao hàng chặng cuối",
        np="vận tải và kho vận", en="logistics and delivery"),
    "game": dict(
        vp="phát hành game di động và các dịch vụ đi kèm",
        np="game và giải trí số", en="mobile games"),
    "bất động sản": dict(
        vp="phát triển ứng dụng môi giới và quản lý bất động sản",
        np="bất động sản", en="real estate technology"),
    "giải pháp doanh nghiệp": dict(
        vp="cung cấp phần mềm quản trị nhân sự, kế toán và bán hàng cho doanh nghiệp vừa và nhỏ",
        np="phần mềm quản trị doanh nghiệp", en="enterprise software"),
    "gia công phần mềm": dict(
        vp="gia công phần mềm cho khách hàng Nhật Bản và châu Âu",
        np="gia công phần mềm", en="software outsourcing"),
}
DOMAIN_COUNTS = [("fintech", 4), ("thương mại điện tử", 4), ("y tế", 2), ("giáo dục", 2), ("logistics", 3),
                 ("game", 2), ("bất động sản", 2), ("giải pháp doanh nghiệp", 3), ("gia công phần mềm", 2)]
COMPANY_NAMES = [
    "Sao Mai Software", "Bình Minh Digital", "Lam Sơn Labs", "Hồng Hà Solutions", "Vân Sơn Tech", "Nhật Quang Soft",
    "Đông Phương Systems", "Tây Nguyên Data", "Hải Đăng Technology", "Kim Long Software", "Ngọc Lan Digital",
    "Phương Nam Labs", "Thanh Tâm Solutions", "Việt Thịnh Tech", "An Khang Software", "Bảo Long Systems",
    "Cửu Hương Digital", "Gia Hưng Labs", "Hoàng Mai Solutions", "Minh Phát Technology", "Quang Vinh Soft",
    "Thái Bình Data", "Trường An Tech", "Xuân Hòa Software",
]
STREETS = ["Nguyễn Huệ", "Lê Lợi", "Trần Hưng Đạo", "Hai Bà Trưng", "Lý Thường Kiệt", "Nguyễn Trãi",
           "Điện Biên Phủ", "Võ Văn Tần", "Cách Mạng Tháng Tám", "Phạm Văn Đồng"]


# ---------------------------------------------------------------- tiện ích
def vj(lst):
    lst = list(lst)
    if len(lst) == 1:
        return lst[0]
    return ", ".join(lst[:-1]) + " và " + lst[-1]


def ej(lst):
    lst = list(lst)
    if len(lst) == 1:
        return lst[0]
    return ", ".join(lst[:-1]) + " and " + lst[-1]


def strip_dia(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFD", s)
    return unicodedata.normalize("NFC", "".join(c for c in s if unicodedata.category(c) != "Mn"))


def stext(skill, p=.25):
    if skill in ALIASES and rnd.random() < p:
        return rnd.choice(ALIASES[skill])
    return skill


def weighted(pairs):
    x, acc = rnd.random(), 0.0
    for v, w in pairs:
        acc += w
        if x < acc:
            return v
    return pairs[-1][0]


def largest_remainder(total, weights):
    raw = [total * w for w in weights]
    base = [int(x) for x in raw]
    rest = total - sum(base)
    order = sorted(range(len(raw)), key=lambda i: raw[i] - base[i], reverse=True)
    for i in order[:rest]:
        base[i] += 1
    return base


# ---------------------------------------------------------------- công ty
def build_companies():
    provs = [p for p, c in PROVINCE_COMPANY_COUNTS for _ in range(c)]
    doms = [d for d, c in DOMAIN_COUNTS for _ in range(c)]
    rnd.shuffle(provs)
    rnd.shuffle(doms)
    names = COMPANY_NAMES[:]
    rnd.shuffle(names)
    out = []
    for i in range(24):
        out.append(dict(
            ref=f"C{i + 1:02d}", name=names[i], domain=doms[i], province=provs[i], ward=None,
            address=f"Số {rnd.randint(10, 250)} đường {rnd.choice(STREETS)}",
            description=f"{names[i]} là công ty chuyên {DOMAINS[doms[i]]['vp']}.",
            website=f"https://company{i + 1:02d}.example.com",
            owner_email=f"employer{i + 1:02d}@jobboard.local",
            owner_name=f"Nhà tuyển dụng {i + 1:02d}",
        ))
    return out


# ---------------------------------------------------------------- tin tuyển dụng
def pick_skills(rk, level):
    r = ROLES[rk]
    core = [rnd.choice(c) if isinstance(c, list) else c for c in r["core"]]
    lo, hi = {"intern": (1, 2), "junior": (2, 3), "middle": (2, 4), "senior": (3, 5)}[level]
    n = min(rnd.randint(lo, hi), len(r["extra"]))
    extra = rnd.sample(r["extra"], n)
    return core, extra


def level_title(base, level, soft):
    if soft:
        return base
    if level == "intern":
        return rnd.choice(["Thực tập sinh {b}", "{b} Intern", "Fresher {b}"]).format(b=base)
    if level == "junior":
        return rnd.choice(["Junior {b}", "{b} (Junior)"]).format(b=base)
    if level == "middle":
        return rnd.choice(["{b}", "{b} (Middle)"]).format(b=base)
    return rnd.choice(["Senior {b}", "{b} (Senior)", "{b} Lead"]).format(b=base)


def salary_for(rk, level):
    lo, hi = {"intern": (3, 7), "junior": (10, 20), "middle": (18, 35), "senior": (35, 65)}[level]
    mult = {"ml_engineer": 1.1, "data_engineer": 1.1, "devops": 1.1, "ui_ux": .95, "ba": .95,
            "data_analyst": .95, "qa": .95}.get(rk, 1.0)
    p_null = .30 if level == "intern" else .15
    if rnd.random() < p_null:
        return None, None
    base = rnd.uniform(lo, hi) * mult
    smin = max(1, round(base * rnd.uniform(.8, 1.0)))
    smax = max(smin + 1, round(smin * rnd.uniform(1.25, 1.6)))
    return smin * 1_000_000, smax * 1_000_000


def domain_sentence(company, province, title, cn, domain_info, tmpl_i):
    vp, np_ = domain_info["vp"], domain_info["np"]
    return [
        f"{cn} là công ty chuyên {vp}. Hiện chúng tôi cần tuyển {title} làm việc tại {province}.",
        f"Về chúng tôi: {cn} hoạt động trong lĩnh vực {np_}. Chúng tôi đang mở vị trí {title} tại {province}.",
        f"Đội ngũ {cn} đang {vp} và cần thêm {title} tại {province}.",
    ][tmpl_i]


def standard_text(ctx, long=False):
    r = ROLES[ctx["role"]]
    di = DOMAINS[ctx["domain"]]
    lines = [domain_sentence(None, ctx["province"], ctx["title"], ctx["cn"], di, rnd.randrange(3)), ""]
    n_duty = len(r["duties"]) if long else 4
    duties = rnd.sample(r["duties"], n_duty)
    lines.append("Mô tả công việc:")
    lines += [f"- {d}" for d in duties]
    lines.append("")
    lines.append("Yêu cầu:")
    pool = LEVEL_VI[ctx["level"]]["soft" if ctx["soft"] else "explicit"]
    lines.append(f"- {rnd.choice(pool)}")
    if long and len(pool) > 1:
        lines.append(f"- {rnd.choice([p for p in pool if f'- {p}' not in lines])}")
    lines.append(f"- Thành thạo {vj([stext(s) for s in ctx['core']])}")
    if ctx["extra"]:
        lines.append(f"- Có kinh nghiệm hoặc biết sử dụng {vj([stext(s) for s in ctx['extra']])}")
    for g in rnd.sample(GENERIC_REQ, 3 if long else 2):
        lines.append(f"- {g}")
    lines.append("")
    lines.append("Quyền lợi:")
    ben = rnd.sample(BENEFITS_VI, 6 if long else 4)
    if ctx["salary_min"] and rnd.random() < .6:
        ben.insert(0, f"Mức lương {ctx['salary_min'] // 1_000_000}-{ctx['salary_max'] // 1_000_000} triệu đồng mỗi tháng")
    if ctx["remote"]:
        ben.insert(0, rnd.choice(REMOTE_VI[ctx["remote"]]))
    lines += [f"- {b}" for b in ben]
    if long:
        lines += ["", rnd.choice(CULTURE_VI)]
    return "\n".join(lines)


def english_text(ctx):
    r = ROLES[ctx["role"]]
    di = DOMAINS[ctx["domain"]]
    lines = [f"We are looking for a {ctx['title']} to join {ctx['cn']} in {ctx['province']}. "
             f"Our products focus on {di['en']}.", "", "Responsibilities:"]
    duties = [f"Design, build and maintain {r['focus_en']}",
              "Collaborate with product, design and QA teams to deliver features on schedule",
              "Write clean, well-tested and documented work",
              "Take part in peer reviews and share knowledge with teammates",
              "Investigate and fix issues reported from production"]
    lines += [f"- {d}" for d in rnd.sample(duties, 4)]
    lines += ["", "Requirements:", f"- {LEVEL_EN[ctx['level']]}",
              f"- Strong knowledge of {ej([stext(s) for s in ctx['core']])}"]
    if ctx["extra"]:
        lines.append(f"- Experience with {ej([stext(s) for s in ctx['extra']])}")
    lines += ["- Good English reading skills", "", "Benefits:"]
    ben = rnd.sample(BENEFITS_EN, 4)
    if ctx["salary_min"] and rnd.random() < .6:
        ben.insert(0, f"Salary: {ctx['salary_min'] // 1_000_000}-{ctx['salary_max'] // 1_000_000} million VND per month")
    if ctx["remote"]:
        ben.insert(0, REMOTE_EN[ctx["remote"]])
    lines += [f"- {b}" for b in ben]
    lines += ["", "Môi trường làm việc trẻ, năng động, đội ngũ nói chuyện bằng cả tiếng Việt và tiếng Anh."]
    return "\n".join(lines)


def short_text(ctx):
    r = ROLES[ctx["role"]]
    di = DOMAINS[ctx["domain"]]
    who = f"{ctx['cn']} chuyên {di['vp']}," if ctx["dm"] else f"{ctx['cn']} đang mở rộng đội ngũ,"
    pool = LEVEL_VI[ctx["level"]]["soft" if ctx["soft"] else "explicit"]
    skills = vj([stext(s) for s in ctx["core"] + ctx["extra"][:2]])
    t = f"{who} cần tuyển {ctx['title']} tại {ctx['province']}. {rnd.choice(r['duties'])}. " \
        f"Yêu cầu: {rnd.choice(pool).lower()}; biết {skills}."
    if ctx["remote"]:
        t += " " + rnd.choice(REMOTE_VI[ctx["remote"]]) + "."
    return t


ABBR = [(" không ", " ko "), (" được ", " đc "), (" với ", " vs "), (" kinh nghiệm", " kn"),
        (" làm việc", " lv"), (" yêu cầu", " yc"), (" biết ", " bít ")]


def sloppy_text(ctx):
    di = DOMAINS[ctx["domain"]]
    lv = (LEVEL_SLOPPY_SOFT if ctx["soft"] else LEVEL_SLOPPY)[ctx["level"]]
    skills = ", ".join(stext(s, .4) for s in ctx["core"] + ctx["extra"][:2])
    parts = [f"tuyển {ctx['title']} gấp" + (f", bên mình làm {di['np']}" if ctx["dm"] else ""),
             f"làm ở {PROV_SHORT[ctx['province']]}", rnd.choice(lv), f"biết {skills}",
             rnd.choice(["lương thỏa thuận, có thưởng", "có thưởng tết, bảo hiểm đủ", "đi làm sớm được ưu tiên"])]
    if ctx["remote"]:
        parts.append("làm remote" if ctx["remote"] == "full" else "hybrid 2 ngày/tuần ở văn phòng")
    parts.append("ib nếu quan tâm")
    s = ". ".join(parts).lower()
    for a, b in ABBR:
        s = s.replace(a, b)
    words = s.split(" ")
    return " ".join(strip_dia(w) if rnd.random() < .35 else w for w in words)


def build_jobs(companies):
    plan = []
    for rk, r in ROLES.items():
        counts = largest_remainder(r["n"], LEVEL_WEIGHTS)
        for lv, c in zip(LEVELS, counts):
            plan += [(rk, lv)] * c
    rnd.shuffle(plan)
    styles = (["standard"] * 165 + ["short"] * 36 + ["long"] * 30 + ["english"] * 30 + ["nodiac"] * 21 + ["sloppy"] * 18)
    rnd.shuffle(styles)
    idxs = list(range(300))
    closed = set(rnd.sample(idxs, 15))
    rem_idx = rnd.sample(idxs, 36)
    remote = {i: ("full" if k < 20 else "hybrid") for k, i in enumerate(rem_idx)}
    jobs, seen = [], set()
    now = datetime.datetime(2026, 10, 14, 12, 0)
    for i, (rk, lv) in enumerate(plan):
        for attempt in range(6):
            comp = rnd.choice(companies)
            province = comp["province"] if rnd.random() < .75 else weighted(JOB_PROVINCE_WEIGHTS)
            style = styles[i]
            soft = rnd.random() < .35
            core, extra = pick_skills(rk, lv)
            smin, smax = salary_for(rk, lv)
            r = ROLES[rk]
            base = rnd.choice(r["en"]) if style == "english" else rnd.choice(r["vi"] + r["en"])
            title = level_title(base, lv, soft)
            if style == "nodiac":
                title = strip_dia(title)
            cn = rnd.choice([comp["name"], "Công ty " + comp["name"]])
            dm = True if style in ("standard", "long", "english", "nodiac") else (rnd.random() < (.5 if style == "short" else .3))
            ctx = dict(role=rk, level=lv, title=title, core=core, extra=extra, province=province,
                       salary_min=smin, salary_max=smax, remote=remote.get(i), soft=soft,
                       cn=cn, domain=comp["domain"], dm=dm)
            if style == "standard":
                desc = standard_text(ctx)
            elif style == "long":
                desc = standard_text(ctx, long=True)
            elif style == "english":
                desc = english_text(ctx)
            elif style == "nodiac":
                desc = strip_dia(standard_text(ctx))
            elif style == "short":
                desc = short_text(ctx)
            else:
                desc = sloppy_text(ctx)
            key = (comp["ref"], title, desc)
            if key not in seen and desc not in {j["description"] for j in jobs}:
                seen.add(key)
                break
        else:
            raise RuntimeError("không sinh được tin không trùng")
        is_closed = i in closed
        if lv == "intern":
            jt = "internship" if rnd.random() < .8 else "part_time"
        else:
            jt = weighted([("full_time", .85), ("contract", .10), ("part_time", .05)])
        created = now - datetime.timedelta(days=rnd.randint(0, 75), hours=rnd.randint(0, 23))
        deadline = (datetime.date(2026, 9, 30) if is_closed
                    else datetime.date(2026, 11, 15) + datetime.timedelta(days=rnd.randint(0, 136)))
        jobs.append(dict(
            ref=f"J{i + 1:03d}", company_ref=comp["ref"], title=title, description=desc, province=province,
            location=province, job_type=jt, level=lv, salary_min=smin, salary_max=smax, currency="VND",
            status="closed" if is_closed else "open", deadline=deadline.isoformat(),
            created_at=created.isoformat() + "+07:00", skills=core + extra,
            _meta=dict(role=rk, family=r["family"], level=lv, style=style, domain=comp["domain"],
                       domain_mentioned=dm, remote_mode=remote.get(i), soft_level_wording=soft),
        ))
    return jobs


# ---------------------------------------------------------------- truy vấn
def M(j):
    return j["_meta"]


def build_queries(jobs):
    R = lambda *rs: (lambda j: M(j)["role"] in rs)
    F = lambda *fs: (lambda j: M(j)["family"] in fs)
    def AND(*fns):
        return lambda j: all(f(j) for f in fns)
    P = lambda p: (lambda j: j["province"] == p)
    L = lambda *ls: (lambda j: j["level"] in ls)
    S = lambda s: (lambda j: s in j["skills"])
    D = lambda d: (lambda j: M(j)["domain"] == d and M(j)["domain_mentioned"])
    RM = lambda m: (lambda j: M(j)["remote_mode"] == m)

    # (câu truy vấn, nhóm, hàm điểm 2, hàm điểm 1 hoặc None, mô tả tiêu chí)
    Q = [
        # ----- nhóm A: từ khóa (full-text kỳ vọng làm tốt)
        ("NestJS backend", "keyword", R("backend_nestjs"), F("backend"),
         "Điểm 2: vị trí backend NestJS. Điểm 1: vị trí backend khác."),
        ("React frontend Hà Nội", "keyword", AND(R("frontend_react"), P(HN)), R("frontend_react"),
         "Điểm 2: frontend React tại Hà Nội. Điểm 1: frontend React ở nơi khác."),
        ("DevOps Docker Kubernetes", "keyword", AND(R("devops"), S("Kubernetes")), R("devops"),
         "Điểm 2: DevOps có Kubernetes. Điểm 1: DevOps khác."),
        ("Java Spring Boot senior", "keyword", AND(R("backend_java"), L("senior")), R("backend_java"),
         "Điểm 2: Java Spring Boot cấp senior. Điểm 1: Java Spring Boot cấp khác."),
        ("tester automation Selenium", "keyword", AND(R("qa"), S("Selenium")), R("qa"),
         "Điểm 2: kiểm thử có Selenium. Điểm 1: kiểm thử khác."),
        ("Data Analyst SQL Power BI", "keyword", AND(R("data_analyst"), S("Power BI")), R("data_analyst"),
         "Điểm 2: phân tích dữ liệu có Power BI. Điểm 1: phân tích dữ liệu khác."),
        ("Flutter Developer TP. Hồ Chí Minh", "keyword", AND(R("mobile_flutter"), P(HCM)), R("mobile_flutter"),
         "Điểm 2: Flutter tại TP. Hồ Chí Minh. Điểm 1: Flutter ở nơi khác."),
        ("Python FastAPI backend", "keyword", AND(R("backend_python"), S("FastAPI")), R("backend_python"),
         "Điểm 2: backend Python dùng FastAPI. Điểm 1: backend Python khác."),
        ("UI/UX Designer Figma", "keyword", R("ui_ux"), None, "Điểm 2: thiết kế UI/UX."),
        (".NET C# developer", "keyword", R("backend_dotnet"), None, "Điểm 2: lập trình .NET."),
        # ----- nhóm B: ngữ nghĩa (diễn đạt khác với nội dung tin)
        ("việc làm cho người mới ra trường muốn làm lập trình phía máy chủ", "semantic",
         AND(F("backend"), L("intern", "junior")), F("backend"),
         "Điểm 2: backend cấp intern hoặc junior. Điểm 1: backend cấp khác."),
        ("làm ứng dụng trên điện thoại di động cho người mới bắt đầu", "semantic",
         AND(F("mobile"), L("intern", "junior")), F("mobile"),
         "Điểm 2: mobile cấp intern hoặc junior. Điểm 1: mobile cấp khác."),
        ("xây dựng giao diện website cho người dùng cuối", "semantic", F("frontend"), R("fullstack"),
         "Điểm 2: frontend. Điểm 1: fullstack."),
        ("xử lý và vận chuyển khối lượng dữ liệu lớn giữa các hệ thống", "semantic", R("data_engineer"), F("data"),
         "Điểm 2: kỹ sư dữ liệu. Điểm 1: nhóm dữ liệu khác."),
        ("kiểm tra chất lượng phần mềm trước khi phát hành", "semantic", F("qa"), None, "Điểm 2: kiểm thử."),
        ("triển khai và giữ cho hệ thống hoạt động ổn định, tự động hóa quy trình phát hành", "semantic",
         R("devops"), None, "Điểm 2: DevOps."),
        ("làm cầu nối giữa khách hàng và đội phát triển, phân tích yêu cầu", "semantic", R("ba"), None,
         "Điểm 2: phân tích nghiệp vụ."),
        ("thiết kế trải nghiệm và giao diện sản phẩm", "semantic", R("ui_ux"), F("frontend"),
         "Điểm 2: thiết kế UI/UX. Điểm 1: frontend."),
        ("huấn luyện mô hình trí tuệ nhân tạo", "semantic", R("ml_engineer"), None, "Điểm 2: kỹ sư học máy."),
        ("công việc làm từ xa, không phải đến công ty", "semantic", RM("full"), RM("hybrid"),
         "Điểm 2: remote hoàn toàn. Điểm 1: hybrid."),
        ("việc công nghệ cho ngân hàng và dịch vụ thanh toán", "semantic", D("fintech"), None,
         "Điểm 2: công ty fintech và tin có nêu lĩnh vực."),
        ("vị trí dành cho người nhiều năm kinh nghiệm, có thể dẫn dắt đội nhóm", "semantic", L("senior"), None,
         "Điểm 2: cấp senior."),
        # ----- nhóm C: không dấu, viết tắt
        ("lap trinh vien backend ha noi", "no_diacritics", AND(F("backend"), P(HN)), F("backend"),
         "Điểm 2: backend tại Hà Nội. Điểm 1: backend ở nơi khác."),
        ("tuyen tester hcm", "no_diacritics", AND(R("qa"), P(HCM)), R("qa"),
         "Điểm 2: kiểm thử tại TP. Hồ Chí Minh. Điểm 1: kiểm thử ở nơi khác."),
        ("fe react junior hcm", "no_diacritics", AND(R("frontend_react"), L("junior")), R("frontend_react"),
         "Điểm 2: frontend React cấp junior. Điểm 1: frontend React cấp khác."),
        ("dev flutter hcm", "no_diacritics", AND(R("mobile_flutter"), P(HCM)), R("mobile_flutter"),
         "Điểm 2: Flutter tại TP. Hồ Chí Minh. Điểm 1: Flutter ở nơi khác."),
        ("be java sr", "no_diacritics", AND(R("backend_java"), L("senior")), R("backend_java"),
         "Điểm 2: Java cấp senior. Điểm 1: Java cấp khác."),
        ("devops hn", "no_diacritics", AND(R("devops"), P(HN)), R("devops"),
         "Điểm 2: DevOps tại Hà Nội. Điểm 1: DevOps ở nơi khác."),
        ("phan tich du lieu sql power bi", "no_diacritics", AND(R("data_analyst"), S("Power BI")), R("data_analyst"),
         "Điểm 2: phân tích dữ liệu có Power BI. Điểm 1: phân tích dữ liệu khác."),
        ("thuc tap sinh frontend", "no_diacritics", AND(F("frontend"), L("intern")), F("frontend"),
         "Điểm 2: frontend cấp intern. Điểm 1: frontend cấp khác."),
    ]
    open_jobs = [j for j in jobs if j["status"] == "open"]
    out = []
    group_pos = Counter()
    group_total = Counter(g for _, g, *_ in Q)
    order = {g: rnd.sample(range(group_total[g]), group_total[g]) for g in group_total}
    for k, (text, group, strict, main, crit) in enumerate(Q):
        rel = {}
        for j in open_jobs:
            if strict(j):
                rel[j["ref"]] = 2
            elif main and main(j):
                rel[j["ref"]] = 1
        n2 = sum(1 for v in rel.values() if v == 2)
        if n2 < 3:
            raise RuntimeError(f"truy vấn '{text}' chỉ có {n2} tin điểm 2")
        pos = order[group][group_pos[group]]
        group_pos[group] += 1
        split = "tune" if pos < round(group_total[group] * .7) else "test"
        out.append(dict(qid=f"Q{k + 1:02d}", query=text, group=group, split=split, criteria=crit, relevant=rel))
    return out


# ---------------------------------------------------------------- CV giả
PROFILES = [
    ("backend_nestjs", "junior", 1, ["NestJS", "TypeScript", "Node.js", "PostgreSQL", "Docker", "Git"]),
    ("backend_nestjs", "middle", 3, ["NestJS", "TypeScript", "Node.js", "Redis", "RabbitMQ", "Docker", "PostgreSQL", "REST API"]),
    ("backend_java", "senior", 6, ["Java", "Spring Boot", "MySQL", "Kafka", "Docker", "Kubernetes", "Microservices", "REST API"]),
    ("backend_java", "intern", 0, ["Java", "Spring Boot", "MySQL", "Git"]),
    ("backend_dotnet", "middle", 3, ["C#", ".NET", "SQL Server", "Docker", "REST API", "Git"]),
    ("backend_python", "junior", 1, ["Python", "FastAPI", "PostgreSQL", "Docker", "Git", "REST API"]),
    ("frontend_react", "junior", 1, ["React", "TypeScript", "JavaScript", "HTML/CSS", "Tailwind CSS", "Git"]),
    ("frontend_react", "senior", 5, ["React", "TypeScript", "Next.js", "Jest", "REST API", "GraphQL", "Git"]),
    ("frontend_vue", "middle", 3, ["Vue.js", "JavaScript", "HTML/CSS", "REST API", "Git", "TypeScript"]),
    ("fullstack", "middle", 3, ["React", "Node.js", "NestJS", "PostgreSQL", "Docker", "TypeScript", "Git"]),
    ("mobile_flutter", "junior", 1, ["Flutter", "Dart", "REST API", "Git", "Firebase"]),
    ("mobile_android", "middle", 3, ["Kotlin", "Android", "REST API", "Git", "Firebase", "Unit test"]),
    ("data_engineer", "middle", 3, ["Python", "SQL", "ETL", "Airflow", "Spark", "PostgreSQL", "Docker"]),
    ("data_analyst", "junior", 1, ["SQL", "Excel", "Power BI", "Python", "Pandas"]),
    ("ml_engineer", "middle", 2, ["Python", "Machine Learning", "PyTorch", "scikit-learn", "NLP", "Docker", "Pandas"]),
    ("qa", "middle", 3, ["Test case", "Postman", "Selenium", "JMeter", "Jira", "SQL"]),
    ("devops", "middle", 4, ["Docker", "Linux", "CI/CD", "Kubernetes", "GitHub Actions", "AWS", "Terraform"]),
    ("ba", "junior", 1, ["UML", "User Story", "Jira", "Agile/Scrum", "SQL"]),
    ("ui_ux", "middle", 3, ["Figma", "Wireframe", "Design System", "Adobe XD", "HTML/CSS"]),
    ("frontend_react", "intern", 0, ["HTML/CSS", "JavaScript", "React", "Git"]),
]
THEMES = ["quản lý bán hàng", "đặt lịch khám bệnh", "ứng dụng học từ vựng", "quản lý thư viện",
          "website tin tức", "theo dõi chi tiêu cá nhân", "đặt phòng khách sạn", "quản lý nhà trọ"]


def lower_first(s):
    return s[0].lower() + s[1:]


def build_resumes():
    out = []
    styles = ["standard"] * 14 + ["messy"] * 3 + ["english"] * 3
    rnd.shuffle(styles)
    for i, (rk, lv, years, skills) in enumerate(PROFILES):
        r = ROLES[rk]
        title = rnd.choice(r["vi"])
        prov = weighted(JOB_PROVINCE_WEIGHTS)
        sk = [stext(s, .15) for s in skills]
        n_exp = {0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3}[years]
        exp = []
        end = 2026
        remaining = years
        for k in range(n_exp):
            seg = max(1, remaining // (n_exp - k)) if k < n_exp - 1 else max(1, remaining)
            start = end - seg
            duties = rnd.sample(r["duties"], 2)
            exp.append(f"{start} - {end} ({seg} năm), công ty (đã ẩn tên), vị trí {title}: "
                       f"{lower_first(duties[0])}; {lower_first(duties[1])}.")
            remaining -= seg
            end = start
        projs = []
        for th in rnd.sample(THEMES, 2):
            projs.append(f"Dự án {th}: {lower_first(rnd.choice(r['duties']))}. Công nghệ: {vj(rnd.sample(sk, min(3, len(sk))))}.")
        objective = {
            "intern": f"Sinh viên năm cuối ngành Công nghệ thông tin, mong muốn thực tập ở vị trí {title} để áp dụng kiến thức vào dự án thực tế.",
            "junior": f"Có {years} năm kinh nghiệm, mong muốn tiếp tục phát triển ở vị trí {title} trong môi trường có người hướng dẫn.",
            "middle": f"Có {years} năm kinh nghiệm ở vị trí {title}, muốn đảm nhận phần việc lớn hơn và học thêm công nghệ mới.",
            "senior": f"Hơn {years} năm kinh nghiệm, từng dẫn dắt nhóm nhỏ, mong muốn đóng góp vào thiết kế kiến trúc và định hướng kỹ thuật.",
        }[lv]
        edu = (f"Đại học (đã ẩn tên), ngành Công nghệ thông tin, dự kiến tốt nghiệp năm 2027." if lv == "intern"
               else f"Đại học (đã ẩn tên), ngành Công nghệ thông tin, tốt nghiệp năm {2026 - years - 1}.")
        name = f"Ứng viên mẫu {i + 1:02d}"
        style = styles[i]
        if style == "english":
            text = "\n".join([name, f"Target role: {rnd.choice(r['en'])}", f"Location: {prov}", "",
                              "Skills", ", ".join(skills), "", "Experience",
                              (" ".join(exp) if exp else "No professional experience yet, final-year student."), "",
                              "Projects", "\n".join(projs), "", "Education", edu])
        else:
            blocks = [name, f"Vị trí ứng tuyển: {title}", f"Email: candidate{i + 1:02d}@example.com | Địa điểm: {prov}", "",
                      "Mục tiêu nghề nghiệp", objective, "", "Kỹ năng", ", ".join(sk), "", "Kinh nghiệm làm việc",
                      ("\n".join(exp) if exp else "Chưa có kinh nghiệm đi làm chính thức."), "", "Dự án", "\n".join(projs),
                      "", "Học vấn", edu]
            text = "\n".join(blocks)
            if style == "messy":
                text = " | ".join(x for x in text.split("\n") if x)
        out.append(dict(ref=f"R{i + 1:02d}", name=name, target_role=rk, level=lv, years=years,
                        province=prov, skills=skills, format=style, text=text))
    return out


# ---------------------------------------------------------------- cặp CV-tin
def compat(cv_role, job_role):
    if cv_role == job_role:
        return 1.0
    fa, fb = ROLES[cv_role]["family"], ROLES[job_role]["family"]
    if "fullstack" in (fa, fb) and ({fa, fb} - {"fullstack"}) <= {"frontend", "backend"}:
        return 0.6
    if fa == fb and fa in ("backend", "frontend", "mobile", "data"):
        return 0.6
    return 0.0


def rule_label(cv, job):
    c = compat(cv["target_role"], M(job)["role"])
    js, cs = set(job["skills"]), set(cv["skills"])
    overlap = len(js & cs) / len(js)
    gap = LEVEL_IDX[job["level"]] - LEVEL_IDX[cv["level"]]
    # Kỹ năng đứng đầu danh sách của tin là kỹ năng bắt buộc (mục "Thành thạo"),
    # phần còn lại là kỹ năng ưu tiên (mục "Có kinh nghiệm hoặc biết sử dụng").
    n_core = len(ROLES[M(job)["role"]]["core"])
    miss_must = [s for s in job["skills"][:n_core] if s not in cs]
    miss_nice = [s for s in job["skills"][n_core:] if s not in cs]
    # Luật (đã siết lại): thiếu 2 kỹ năng bắt buộc, hoặc thiếu 1 kỹ năng bắt buộc mà còn thấp hơn
    # tin một cấp trở lên, hoặc thấp hơn 2 cấp, hoặc khác loại vị trí -> không phù hợp.
    # Phù hợp chỉ khi đúng loại vị trí, đủ kỹ năng bắt buộc, không thấp hơn tin cấp nào,
    # và thiếu tối đa 1 kỹ năng ưu tiên. Còn lại là cần xem xét.
    if c == 0 or overlap < .2 or gap >= 2 or len(miss_must) >= 2 or (miss_must and gap >= 1):
        lab = "unsuitable"
    elif c < 1.0 and (miss_must or len(miss_nice) >= 3):
        # Bổ sung sau khi chấm tay: khác loại vị trí mà còn thiếu kỹ năng bắt buộc
        # hoặc thiếu từ 3 kỹ năng ưu tiên trở lên thì không đáng xem.
        lab = "unsuitable"
    elif c == 1.0 and not miss_must and -1 <= gap <= 0 and len(miss_nice) <= 1:
        lab = "suitable"
    else:
        lab = "review"
    return lab, dict(role_compat=c, skill_overlap=round(overlap, 2), level_gap=gap,
                     matched_skills=sorted(js & cs), missing_skills=sorted(js - cs),
                     missing_must_have=miss_must, missing_nice_to_have=miss_nice)


def build_pairs(jobs, resumes):
    open_jobs = [j for j in jobs if j["status"] == "open"]
    cands = {"suitable": [], "review": [], "unsuitable": []}
    for cv in resumes:
        for j in open_jobs:
            lab, why = rule_label(cv, j)
            cands[lab].append((cv, j, why))
    for v in cands.values():
        rnd.shuffle(v)
    target = {"suitable": 13, "review": 14, "unsuitable": 13}
    for k, t in target.items():
        if len(cands[k]) < t:
            raise RuntimeError(f"không đủ ứng viên cho nhãn {k}: {len(cands[k])}")
    use_cv, use_job, chosen = Counter(), set(), []

    def take(label, pool, want):
        got = 0
        for cv, j, why in pool:
            if got >= want:
                break
            if use_cv[cv["ref"]] >= 3 or j["ref"] in use_job:
                continue
            chosen.append((label, cv, j, why))
            use_cv[cv["ref"]] += 1
            use_job.add(j["ref"])
            got += 1
        return got

    take("suitable", cands["suitable"], 13)
    take("review", cands["review"], 14)
    hard = [x for x in cands["unsuitable"] if x[2]["role_compat"] > 0]
    easy = [x for x in cands["unsuitable"] if x[2]["role_compat"] == 0]
    g = take("unsuitable", hard, 6)
    take("unsuitable", easy, 13 - g)
    rnd.shuffle(chosen)
    pairs = []
    by_label = Counter()
    for k, (label, cv, j, why) in enumerate(chosen):
        by_label[label] += 1
        pairs.append(dict(pair_id=f"P{k + 1:02d}", resume_ref=cv["ref"], job_ref=j["ref"], label_auto=label,
                          label_human=None, reason=why))
    # chia tập chỉnh/tập đo theo từng nhãn (khoảng 70/30)
    for label in target:
        idx = [p for p in pairs if p["label_auto"] == label]
        cut = round(len(idx) * .7)
        for n, p in enumerate(idx):
            p["split"] = "tune" if n < cut else "test"
    return pairs


# ---------------------------------------------------------------- ghi file
def check_columns(jobs, companies):
    for c in companies:
        assert len(c["name"]) <= 200 and len(c["address"]) <= 255 and len(c["owner_name"]) <= 150
    for j in jobs:
        assert len(j["title"]) <= 150, j["title"]
        assert len(j["location"]) <= 150
        assert j["level"] in LEVELS
        assert j["job_type"] in ("full_time", "part_time", "internship", "contract")
        assert j["status"] in ("open", "closed", "blocked")
        if j["salary_min"] and j["salary_max"]:
            assert j["salary_max"] >= j["salary_min"]


def write_json(name, obj):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def write_csv(name, header, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main():
    companies = build_companies()
    jobs = build_jobs(companies)
    check_columns(jobs, companies)
    queries = build_queries(jobs)
    resumes = build_resumes()
    pairs = build_pairs(jobs, resumes)

    skills = sorted({s for j in jobs for s in j["skills"]} | {s for r in resumes for s in r["skills"]})
    write_json("skills.json", [dict(name=s, aliases=ALIASES.get(s, [])) for s in skills])
    write_json("companies.json", companies)
    write_json("jobs.json", jobs)
    write_json("queries.json", queries)
    write_json("resumes.json", resumes)
    write_json("pairs.json", pairs)

    jt = {j["ref"]: j["title"] for j in jobs}
    rt = {r["ref"]: r["target_role"] + " / " + r["level"] for r in resumes}
    write_csv("pairs_review.csv",
              ["pair_id", "cv", "cv_vi_tri_cap_do", "job", "job_title", "label_auto", "ly_do_tu_dong", "label_human", "split"],
              [[p["pair_id"], p["resume_ref"], rt[p["resume_ref"]], p["job_ref"], jt[p["job_ref"]], p["label_auto"],
                f"compat={p['reason']['role_compat']}, overlap={p['reason']['skill_overlap']}, gap={p['reason']['level_gap']}",
                "", p["split"]] for p in pairs])
    write_csv("queries_review.csv",
              ["qid", "query", "group", "split", "so_tin_diem_2", "so_tin_diem_1", "tieu_chi", "kiem_tra_tay (dung/sai)"],
              [[q["qid"], q["query"], q["group"], q["split"],
                sum(1 for v in q["relevant"].values() if v == 2), sum(1 for v in q["relevant"].values() if v == 1),
                q["criteria"], ""] for q in queries])

    stats = dict(
        so_tin=len(jobs), so_cong_ty=len(companies), so_cv=len(resumes), so_truy_van=len(queries), so_cap=len(pairs),
        theo_vi_tri=Counter(M(j)["role"] for j in jobs), theo_cap_do=Counter(j["level"] for j in jobs),
        theo_tinh=Counter(j["province"] for j in jobs), theo_van_phong=Counter(M(j)["style"] for j in jobs),
        theo_trang_thai=Counter(j["status"] for j in jobs), theo_remote=Counter(str(M(j)["remote_mode"]) for j in jobs),
        nhan_cap=Counter(p["label_auto"] for p in pairs), tach_cap=Counter(p["split"] + "/" + p["label_auto"] for p in pairs),
        tach_truy_van=Counter(q["group"] + "/" + q["split"] for q in queries),
        tin_diem_2_moi_truy_van={q["qid"]: sum(1 for v in q["relevant"].values() if v == 2) for q in queries},
        tin_diem_1_moi_truy_van={q["qid"]: sum(1 for v in q["relevant"].values() if v == 1) for q in queries},
    )
    write_json("stats.json", stats)
    print(json.dumps(stats, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
