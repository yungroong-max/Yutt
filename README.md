# 🏆 Sportlife — คู่มือนำขึ้นออนไลน์

## 📁 โครงสร้างไฟล์
```
sportthai/
├── index.html          ← หน้าหลัก
├── css/
│   └── style.css       ← สไตล์ทั้งหมด
├── js/
│   └── app.js          ← โค้ดหลัก (API + Logic)
└── README.md           ← คู่มือนี้
```

---

## 🔑 Step 1: รับ API Keys (ฟรี)

### NewsData.io (ข่าวจริง)
1. ไปที่ https://newsdata.io/register
2. สมัครฟรี → ยืนยัน Email
3. ไปที่ Dashboard → Copy **API Key** (ขึ้นต้นด้วย `pub_`)
4. ใช้ได้ **200 requests/วัน** ฟรี

### Anthropic Claude (AI แปล + วิเคราะห์)
1. ไปที่ https://console.anthropic.com
2. สมัครและเติมเครดิต (เริ่มต้น $5)
3. ไปที่ API Keys → Create Key (ขึ้นต้นด้วย `sk-ant-`)

---

## 🌐 Step 2: นำขึ้นออนไลน์ฟรี (3 วิธี)

---

### ✅ วิธีที่ 1: Netlify (แนะนำ — ง่ายที่สุด)
**ไม่ต้องเขียนโค้ดเพิ่ม | ได้ URL ภายใน 2 นาที**

1. ไปที่ https://netlify.com → Sign up ฟรี
2. กด **"Add new site"** → **"Deploy manually"**
3. **ลาก Folder `sportthai/` ทั้งโฟลเดอร์** ไปใส่กล่อง
4. รอ 30 วินาที → ได้ URL เช่น `https://sportthai-live.netlify.app`
5. ตั้งชื่อ Custom URL ได้ฟรี เช่น `sportthai.netlify.app`

**ต่ออัปเดตไฟล์:** ลาก folder ใหม่ลงไปอีกครั้ง

---

### ✅ วิธีที่ 2: GitHub Pages (ฟรี — เหมาะถ้ามี GitHub)

1. สร้าง Account ที่ https://github.com
2. กด **New Repository** → ชื่อ `sportthai-live` → Public
3. อัปโหลดไฟล์ทั้งหมด (drag & drop)
4. ไปที่ **Settings → Pages → Source: main branch**
5. ได้ URL: `https://[username].github.io/sportthai-live`

---

### ✅ วิธีที่ 3: Vercel (เร็วที่สุด)

1. ไปที่ https://vercel.com → Sign up
2. กด **New Project** → Import GitHub repo
3. หรือ ใช้ Vercel CLI: `npx vercel --prod`
4. ได้ URL: `https://sportthai-live.vercel.app`

---

## ⚙️ Step 3: ตั้งค่า API Key บนเว็บ

เมื่อเปิดเว็บครั้งแรก จะมีกล่องให้กรอก:
- **NewsData.io Key**: `pub_xxxxxxxxxx`
- **Anthropic Key**: `sk-ant-xxxxxxxxxx`

กด **"💾 บันทึก & โหลดข่าว"** → เว็บจะจำ Key ใน localStorage อัตโนมัติ

---

## 🔄 การอัปเดตข่าว

| ระบบ | ความถี่ | แหล่งที่มา |
|------|---------|------------|
| NewsData.io | ทุก 10 นาที | ข่าวจริงจาก 80,000+ แหล่ง |
| Claude AI | ทุกครั้งที่กด Refresh | AI สร้างข่าวสำรอง |
| ผลการแข่งขัน | ทุก 10 นาที | Claude AI |
| กระแสร้อนแรง | ทุก 10 นาที | Claude AI |

---

## 📡 แหล่งข่าวที่ครอบคลุม

**ต่างประเทศ:** BBC Sport, ESPN, Goal.com, Sky Sports, The Athletic, F1 Official, UFC, NBA.com, BWF Official

**ในประเทศ:** Siamsport, Thaisport.net, Sanook Sport, MThai Sport, Kapook Sport

---

## 💡 Tips เพิ่มเติม

### เพิ่ม Custom Domain
- Netlify: Settings → Domain → Add custom domain
- ราคา domain `.com` ประมาณ 300-500 บาท/ปี (จาก Namecheap, GoDaddy)

### ปรับแต่งโลโก้/สี
- แก้ไฟล์ `css/style.css` บรรทัด `:root` → เปลี่ยน `--red`, `--gold`
- เปลี่ยนชื่อเว็บในไฟล์ `index.html` บรรทัด `.logo-text`

### เพิ่มข่าวไทยมากขึ้น
แก้ในไฟล์ `js/app.js` ฟังก์ชัน `fetchFromNewsData()`:
```javascript
// เพิ่มภาษาไทยมากขึ้น
`${CONFIG.NEWSDATA_BASE}?apikey=${state.newsApiKey}&country=th&category=sports&language=th&size=15`
```

---

## 🆓 ค่าใช้จ่าย

| บริการ | แผนฟรี | จำกัด |
|--------|--------|-------|
| Netlify | ✅ ฟรี | 100GB/เดือน |
| NewsData.io | ✅ ฟรี | 200 req/วัน |
| Anthropic API | ❌ จ่ายตามใช้ | ~$0.003/req |
| Domain `.com` | ❌ ~400บ/ปี | - |

**ค่าใช้จ่ายรายเดือนโดยประมาณ:** $3-10 (ขึ้นอยู่กับการใช้ Claude API)
