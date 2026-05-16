// No require needed for Node 18+
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVfYWRtaW4iLCJ1c2VybmFtZSI6ImFkbWluIiwibmFtZSI6Iuezu-e7n-euoeeQhuWRmCIsInJvbGUiOiJhZG1pbiIsImlzQW5vbnltb3VzIjpmYWxzZSwiaWF0IjoxNzY2NjM3MjUzLCJleHAiOjE3NjY3MjM2NTN9.AQxTpITAwjeVBxz89AhlufP3WgL_Ep1JxDEdjd6pvWo";
const BASE_URL = "http://127.0.0.1:3001/api";

async function test() {
    console.log("Testing API...");

    // 1. Health
    try {
        const res = await fetch(`${BASE_URL}/health`);
        console.log("Health:", await res.json());
    } catch (e) {
        console.error("Health Failed:", e.message);
    }

    // 2. GET Courses
    let course = null;
    try {
        const res = await fetch(`${BASE_URL}/courses`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        if (res.status !== 200) {
            console.log("GET /courses Status:", res.status);
            console.log("Body:", await res.text());
        } else {
            const courses = await res.json();
            console.log("GET /courses Success. Count:", courses.length);
            course = courses[0];
            console.log("Sample Course:", course.id, course.title, "Author:", course.authorId, "Perm:", course.hasPermission);
        }
    } catch (e) {
        console.error("GET /courses Failed:", e.message);
    }

    if (!course) return;

    // 3. POST Course (Edit) - Send existing data but try to update status
    try {
        console.log("Attempting to update course:", course.id);
        const res = await fetch(`${BASE_URL}/courses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...course,
                description: course.description + " [Updated by Script]"
            })
        });
        if (res.status === 200) {
            console.log("POST /courses Success:", await res.json());
        } else {
            console.log("POST /courses Fail:", res.status, await res.text());
        }
    } catch (e) {
        console.error("POST /courses Failed:", e.message);
    }

    // 4. POST Cache (Simulate One-Click)
    try {
        console.log("Attempting to save cache for course:", course.id);
        const res = await fetch(`${BASE_URL}/cache`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courseId: course.id,
                nodeId: 'test_node',
                type: 'server_test',
                data: 'test data'
            })
        });
        if (res.status === 200) {
            console.log("POST /cache Success:", await res.json());
        } else {
            console.log("POST /cache Fail:", res.status, await res.text());
        }
    } catch (e) {
        console.error("POST /cache Failed:", e.message);
    }
}

test();
