// ================= CẤU HÌNH API =================
// Thay KEY của bạn vào đây (giữ nguyên key cũ nếu đang dùng tốt)
const GEMINI_API_KEY = "AIzaSyDJJYZx3HYiO7Nb66gLKdwqTS9qr8OVw-s";
// ================================================

// Prompt "Đa ngôn ngữ" linh hoạt
let aiChatHistory = [
    {
        role: "user",
        parts: [
            {
                text: `You are a smart AI Tutor for the EngMist app. 
                I will provide you with my current learning data (Vocabulary list, Streak, XP, etc.).
                
                RULES:
                1. **Language:** If I speak English, reply in English. If I speak Vietnamese, reply in Vietnamese.
                2. **Context Aware:** Use the provided data to create quizzes, stories, or check my progress.
                3. **Teaching:** If I ask about a word in my list, check its specific meaning/example in the data first.
                4. **Tone:** Friendly, concise, and motivating.`,
            },
        ],
    },
];

function toggleAIChat() {
    const box = document.getElementById("ai-chat-box");
    const btn = document.getElementById("ai-toggle-btn");
    if (box.classList.contains("hidden")) {
        box.classList.remove("hidden");
        btn.classList.add("hidden");
        setTimeout(() => document.getElementById("ai-user-input").focus(), 100);
    } else {
        box.classList.add("hidden");
        btn.classList.remove("hidden");
    }
}

function clearAIChat() {
    const container = document.getElementById("ai-messages");
    container.innerHTML =
        '<div class="ai-msg-bubble ai-intro">Đã xóa lịch sử. Mình sẵn sàng học bài mới!</div>';
    aiChatHistory = [aiChatHistory[0]];
}

// --- HÀM MỚI: TỔNG HỢP DỮ LIỆU WEB ---
function getFullWebsiteContext() {
    if (typeof appState === "undefined") return "";

    // 1. Lấy thống kê cơ bản
    const stats = `Current XP: ${appState.xp}, Streak: ${appState.streak} days.`;

    // 2. Lấy danh sách từ yếu (Stability thấp < 2 ngày)
    const weakWords = appState.cards
        .filter((c) => c.stability > 0 && c.stability < 2)
        .map((c) => c.word)
        .join(", ");

    // 3. Lấy toàn bộ từ vựng (Gồm Word + Meaning + Example)
    // Format: "Word (Nghĩa) - Ex: Ví dụ"
    const allVocab = appState.cards
        .map((c) => `- ${c.word} (${c.meaning}): ${c.example || "No example"}`)
        .join("\n");

    // 4. Lấy danh sách bài đọc
    const readings = appState.readings
        ? appState.readings.map((r) => r.title).join(", ")
        : "";

    const hardWords = appState.cards
        .filter((c) => c.difficulty > 2.5)
        .sort((a, b) => a.stability - b.stability)
        .slice(0, 5)
        .map((c) => c.word)
        .join(", ");

    return `
        [SYSTEM DATA - DO NOT REPLY TO THIS PART, JUST READ IT]
        ${stats}
        My Weak Words (Review needed): ${weakWords || "None"}.
        My Reading Lessons: ${readings}.
        MY TROUBLE WORDS: ${hardWords}. (Please create sentences using these words to help me remember).
        FULL VOCABULARY LIST:
        ${allVocab}
        [END SYSTEM DATA]
        `;
}

async function sendAIMessage() {
    const input = document.getElementById("ai-user-input");
    const loading = document.getElementById("ai-loading");
    const text = input.value.trim();

    if (!text) return;

    // 1. Hiển thị tin nhắn người dùng
    addAIBubble(text, "user-bubble");
    input.value = "";
    loading.style.display = "block";

    // 2. Lấy dữ liệu mới nhất từ web
    const contextData = getFullWebsiteContext();

    // 3. Gửi tin nhắn kèm dữ liệu (Context injection)
    // Chúng ta ghép dữ liệu vào tin nhắn, nhưng AI sẽ hiểu đó là thông tin nền
    const messageToSend = `${text}\n\n${contextData}`;

    aiChatHistory.push({ role: "user", parts: [{ text: messageToSend }] });

    try {
        // Sửa model thành 2.5 theo yêu cầu mới nhất
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: aiChatHistory }),
            }
        );

        const data = await response.json();

        if (data.error) {
            addAIBubble("Lỗi: " + data.error.message, "bot-bubble");
        } else {
            const aiReply = data.candidates[0].content.parts[0].text;
            addAIBubble(aiReply, "bot-bubble");
            aiChatHistory.push({ role: "model", parts: [{ text: aiReply }] });
        }
    } catch (error) {
        console.error(error);
        addAIBubble("Mất kết nối mạng!", "bot-bubble");
    } finally {
        loading.style.display = "none";
    }
}

function addAIBubble(text, className) {
    const div = document.createElement("div");
    div.className = `ai-msg-bubble ${className}`;
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        .replace(/\n/g, "<br>");
    div.innerHTML = formattedText;
    const container = document.getElementById("ai-messages");
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function handleAIEnter(e) {
    if (e.key === "Enter") sendAIMessage();
}

// --- AI READING GENERATOR ---

// --- LOGIC MỚI CHO AI READING GENERATOR ---

function openAIReadingGenerator() {
    // 1. Chuẩn bị danh sách chủ đề
    const select = document.getElementById("ai-topic-select");
    select.innerHTML = '<option value="">-- Vui lòng chọn chủ đề --</option>';

    // Lấy các chủ đề hiện có trong app của bạn
    const existingTopics = [
        ...new Set(appState.cards.map((c) => c.topic)),
    ].filter((t) => t);

    // Thêm các chủ đề gợi ý thú vị
    const suggestTopics = [
        "Daily Life (Đời sống)",
        "Travel Adventure (Du lịch)",
        "Funny Story (Hài hước)",
        "Future Technology (Công nghệ)",
        "Love & Romance (Tình yêu)",
        "Horror Story (Kinh dị)",
        "Business & Work (Công sở)",
    ];

    // Gộp lại và loại bỏ trùng lặp
    const allTopics = [...new Set([...existingTopics, ...suggestTopics])];

    allTopics.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.innerText = t;
        select.appendChild(opt);
    });

    // Thêm option đặc biệt "Tự nhập"
    const other = document.createElement("option");
    other.value = "custom";
    other.innerText = "✏️ Nhập chủ đề khác...";
    other.style.fontWeight = "bold";
    other.style.color = "#a855f7";
    select.appendChild(other);

    // 2. Reset trạng thái Modal
    document.getElementById("ai-custom-topic-group").style.display = "none";
    document.getElementById("ai-custom-topic").value = "";

    const btn = document.getElementById("btn-start-ai");
    btn.innerHTML = "<span>✨ Tạo bài đọc ngay</span>";
    btn.disabled = false;
    btn.style.opacity = "1";

    // 3. Mở Modal
    document.getElementById("ai-reading-modal").classList.add("open");
}

// Hàm xử lý khi chọn "Nhập chủ đề khác"
function toggleAICustomTopic() {
    const val = document.getElementById("ai-topic-select").value;
    const customGroup = document.getElementById("ai-custom-topic-group");
    if (val === "custom") {
        customGroup.style.display = "block";
        setTimeout(
            () => document.getElementById("ai-custom-topic").focus(),
            100
        );
    } else {
        customGroup.style.display = "none";
    }
}

// Hàm thực thi gọi AI
async function startAIGenerate() {
    // 1. LẤY CHỦ ĐỀ
    const selectVal = document.getElementById("ai-topic-select").value;
    let topic = selectVal;

    if (!topic) {
        showToast("Vui lòng chọn chủ đề!", "error");
        return;
    }
    if (topic === "custom") {
        topic = document.getElementById("ai-custom-topic").value.trim();
        if (!topic) {
            showToast("Vui lòng nhập chủ đề!", "error");
            document.getElementById("ai-custom-topic").focus();
            return;
        }
    }

    // --- MỚI: LẤY TÙY CHỈNH NGƯỜI DÙNG ---
    const requestedCount =
        parseInt(document.getElementById("ai-vocab-count").value) || 5;
    const lengthOption = document.getElementById("ai-story-length").value;

    let lengthText = "about 150 words"; // Mặc định Medium
    if (lengthOption === "short") lengthText = "about 80-100 words (concise)";
    if (lengthOption === "long") lengthText = "about 300-400 words (detailed)";

    // 2. CHỌN TỪ VỰNG (Theo số lượng yêu cầu)
    const learningWords = appState.cards
        .filter((c) => c.stability > 0)
        .map((c) => c.word);

    let targetWords = [];

    // Nếu kho từ vựng đang học ĐỦ để đáp ứng yêu cầu
    if (learningWords.length >= requestedCount) {
        // Lấy ngẫu nhiên trong danh sách đang học
        targetWords = learningWords
            .sort(() => 0.5 - Math.random())
            .slice(0, requestedCount);
    } else {
        // Nếu thiếu, lấy hết từ đang học + bù thêm từ trong kho (chưa học)
        const remainingNeeded = requestedCount - learningWords.length;
        const pool = appState.cards
            .filter((c) => c.stability === 0)
            .map((c) => c.word); // Lấy từ chưa học
        const randomPool = pool
            .sort(() => 0.5 - Math.random())
            .slice(0, remainingNeeded);

        targetWords = [...learningWords, ...randomPool];

        // Nếu vẫn không đủ (do tổng kho quá ít), thì lấy hết những gì có thể
        if (targetWords.length < requestedCount) {
            // Fallback: Lấy tất cả cards nếu kho quá nhỏ
            targetWords = appState.cards
                .slice(0, requestedCount)
                .map((c) => c.word);
        }
    }

    if (targetWords.length === 0) {
        showToast("Kho từ vựng trống!", "error");
        return;
    }

    // 3. UI LOADING
    const btn = document.getElementById("btn-start-ai");
    btn.innerHTML =
        '<i class="ph-bold ph-spinner ph-spin" style="font-size:20px;"></i> Đang viết...';
    btn.disabled = true;
    btn.style.opacity = "0.7";

    // 4. TẠO PROMPT (Cập nhật độ dài)
    const promptText = `
        Write a creative English story or article (${lengthText}) about the topic "${topic}".
        MUST include these ${targetWords.length} words: ${targetWords.join(
        ", "
    )}.
        
        Format rules:
        - Wrap the target words in **bold** (e.g., **word**) every time they appear.
        - Level: B1 (Intermediate).
        - Make the story engaging and logical.
        - Return ONLY the content string, no intro/outro text.
    `;

    // 5. GỌI API (Phần này giữ nguyên như cũ)
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                }),
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let aiText = data.candidates[0].content.parts[0].text;

        // Xử lý in đậm
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

        const newReading = {
            id: Date.now(),
            title: `AI Story: ${topic}`, // Tiêu đề vẫn giữ tên chủ đề cho dễ nhớ
            topic: topic, // <--- SỬA THÀNH: Lấy đúng chủ đề người dùng chọn
            stage: "1",
            content: aiText,
        };

        appState.readings.push(newReading);
        if (typeof saveData === "function") saveData();

        closeModal("ai-reading-modal");
        if (typeof renderReadingManagerTable === "function")
            renderReadingManagerTable();
        showToast("Đã tạo xong bài đọc! 🎉", "success");

        if (confirm("Bài đọc đã xong! Mở xem ngay?")) {
            if (typeof switchView === "function") switchView("reading");
            if (typeof openReadingView === "function")
                openReadingView(newReading);
        }
    } catch (error) {
        console.error(error);
        showToast("Lỗi: " + error.message, "error");
    } finally {
        // Reset nút bấm
        btn.innerHTML = "<span>✨ Tạo bài đọc</span>";
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

/* --- TẠO BÀI ĐỌC TỪ CÁC TỪ ĐÃ ÔN --- */
async function generateStoryFromReviewed() {
    // 1. Lấy danh sách từ đã ôn hôm nay
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const reviewedToday = appState.cards.filter(
        (c) => c.lastReview && c.lastReview >= todayStart.getTime()
    );

    // Giới hạn tối đa 20 từ để bài đọc không bị quá tải (AI viết hay hơn)
    const targetWords = reviewedToday.slice(0, 20).map((c) => c.word);

    if (targetWords.length === 0) {
        alert("Không tìm thấy từ đã ôn hôm nay!");
        return;
    }

    // 2. UI Loading
    // Thử lấy nút ở Modal trước, nếu không có thì lấy nút ở Empty State
    let btn = document.getElementById("btn-create-story-reviewed-modal");
    if (!btn) btn = document.getElementById("btn-create-story-reviewed");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Đang viết...';
    btn.disabled = true;
    btn.style.opacity = "0.7";

    // 3. Tạo Prompt
    const promptText = `
        Write a creative short story (Level B1, about 150 words) that MUST include these specific words: ${targetWords.join(
            ", "
        )}.
        
        Topic: Daily Life or Funny Story.
        Format rules:
        - Highlight the target words by wrapping them in **bold** (e.g. **word**) every time they appear.
        - Keep the story coherent and natural.
        - Return ONLY the story content text.
    `;

    // 4. Gọi API
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                }),
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let aiText = data.candidates[0].content.parts[0].text;
        // Xử lý in đậm
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

        // 5. Lưu và Mở bài đọc
        const newReading = {
            id: Date.now(),
            title: `Review Story: ${new Date().toLocaleDateString("vi-VN")}`,
            topic: "Review",
            stage: "1",
            content: aiText,
        };

        appState.readings.push(newReading);
        if (typeof saveData === "function") saveData();

        // Chuyển hướng sang trang đọc
        if (typeof switchView === "function") switchView("reading");
        if (typeof openReadingView === "function") openReadingView(newReading);

        // Thông báo
        const toast = document.createElement("div"); // Simple toast logic or use existing showToast
        if (typeof showToast === "function")
            showToast("Đã tạo bài đọc ôn tập! 🎉", "success");
    } catch (error) {
        console.error(error);
        alert("Lỗi khi gọi AI: " + error.message);
    } finally {
        // Reset nút
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.opacity = "1";
    }

    closeModal("review-story-modal");
}
