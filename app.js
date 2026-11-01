let token = localStorage.getItem("learnspace_token") || "";
let user = JSON.parse(localStorage.getItem("learnspace_user") || "null");
let authMode = "login";
let currentCourse = null;
const $ = id => document.getElementById(id);
const icons = ["☁","⌘","✦","▣","◈","◎"];
async function api(url, options = {}) {
  options.headers = options.headers || {};
  if (token) options.headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function message(id, value, success=false) { $(id).textContent=value; $(id).className=success?"message success":"message"; }
function updateAccount() {
  $("userLabel").textContent = user ? user.name : "Guest";
  $("authOpen").classList.toggle("hidden", !!user);
  $("logoutBtn").classList.toggle("hidden", !user);
  $("myCoursesNav").classList.toggle("hidden", !user);
  $("adminPanel").classList.toggle("hidden", !user || user.role !== "admin");
}
function openModal(mode="login") {
  authMode=mode; $("authModal").classList.remove("hidden");
  $("loginTab").classList.toggle("active",mode==="login");
  $("registerTab").classList.toggle("active",mode==="register");
  $("fullName").classList.toggle("hidden",mode!=="register");
  $("fullName").required=mode==="register";
  $("authTitle").textContent=mode==="login"?"Welcome back":"Create your account";
  $("authSub").textContent=mode==="login"?"Log in to continue learning.":"Join LearnSpace and start learning.";
  $("authSubmit").textContent=mode==="login"?"Login":"Create account";
  message("authMessage","");
}
$("authOpen").onclick=()=>openModal("login");
$("closeModal").onclick=()=>$("authModal").classList.add("hidden");
$("loginTab").onclick=()=>openModal("login");
$("registerTab").onclick=()=>openModal("register");
$("authModal").addEventListener("click",e=>{if(e.target===$("authModal"))$("authModal").classList.add("hidden")});
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); message("authMessage","Please wait...");
  const body={email:$("email").value.trim(),password:$("password").value};
  if(authMode==="register") body.name=$("fullName").value.trim();
  try {
    if(authMode==="register") {
      const result=await api("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      message("authMessage",result.message,true); openModal("login");
    } else {
      const result=await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      token=result.token; user=result.user;
      localStorage.setItem("learnspace_token",token);localStorage.setItem("learnspace_user",JSON.stringify(user));
      $("authModal").classList.add("hidden");updateAccount();loadCourses();
    }
  } catch(err){message("authMessage",err.message)}
});
$("logoutBtn").onclick=()=>{
  token="";user=null;localStorage.removeItem("learnspace_token");localStorage.removeItem("learnspace_user");
  updateAccount();showBrowse();loadCourses();
};
function showBrowse(){
  $("sectionTitle").textContent="Explore popular courses";$("sectionSub").textContent="Choose a course and start building your skills.";
  $("browseNav").classList.add("active");$("myCoursesNav").classList.remove("active");$("lessonPanel").classList.add("hidden");
  $("searchInput").classList.remove("hidden");loadCourses();
}
async function loadCourses(){
  $("courseGrid").innerHTML='<div class="empty">Loading courses...</div>';
  try{renderCourses(await api("/api/courses"))}catch(e){$("courseGrid").innerHTML=`<div class="empty">${e.message}</div>`}
}
function renderCourses(courses){
  const query=$("searchInput").value.toLowerCase();
  courses=courses.filter(c=>(c.title+" "+c.category+" "+c.description).toLowerCase().includes(query));
  $("courseGrid").innerHTML="";
  if(!courses.length){$("courseGrid").innerHTML='<div class="empty">No courses found. Try another search.</div>';return}
  courses.forEach((c,i)=>{
    const card=document.createElement("article");card.className="course-card";
    const banner=document.createElement("div");banner.className="course-banner";
    const cat=document.createElement("span");cat.className="category";cat.textContent=c.category;
    const sym=document.createElement("span");sym.className="symbol";sym.textContent=icons[i%icons.length];banner.append(cat,sym);
    const body=document.createElement("div");body.className="course-body";
    const title=document.createElement("h3");title.textContent=c.title;
    const desc=document.createElement("p");desc.className="course-desc";desc.textContent=c.description;
    const meta=document.createElement("div");meta.className="course-meta";meta.textContent=`${c.instructor} · ${c.duration} · ${c.lesson_count} lessons`;
    const btn=document.createElement("button");btn.className="primary";btn.textContent=user?"View course":"View course";btn.onclick=()=>openCourse(c.id);
    body.append(title,desc,meta,btn);card.append(banner,body);$("courseGrid").append(card);
  });
}
async function openCourse(id){
  try{
    const c=await api(`/api/courses/${id}`);currentCourse=c;
    const panel=$("lessonPanel");panel.classList.remove("hidden");
    panel.innerHTML="";
    const heading=document.createElement("h2");heading.textContent=c.title;
    const desc=document.createElement("p");desc.className="sub";desc.textContent=`${c.description} · Instructor: ${c.instructor}`;
    panel.append(heading,desc);
    if(!user){
      const p=document.createElement("p");p.className="sub";p.textContent="Create an account or log in to enroll and access lessons.";
      const b=document.createElement("button");b.className="primary";b.textContent="Login to enroll";b.onclick=()=>openModal("login");panel.append(p,b);
    } else {
      const enroll=document.createElement("button");enroll.className="primary";enroll.style.marginTop="15px";enroll.textContent="Enroll in this course";
      enroll.onclick=async()=>{try{const r=await api(`/api/courses/${id}/enroll`,{method:"POST"});alert(r.message);openCourse(id)}catch(e){alert(e.message);if(e.message.includes("already enrolled"))showLessons(c)}};
      panel.append(enroll);
      try{const mine=await api("/api/my-courses");if(mine.some(x=>x.id===c.id))showLessons(c)}
      catch(e){console.error(e)}
    }
    panel.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){alert(e.message)}
}
async function showLessons(c){
  const panel=$("lessonPanel");panel.innerHTML="";
  const h=document.createElement("h2");h.textContent=c.title+" — Lessons";panel.append(h);
  for(const l of c.lessons){
    const row=document.createElement("div");row.className="lesson-row";
    const name=document.createElement("span");name.textContent=`${l.position}. ${l.title}`;
    const b=document.createElement("button");b.className="outline";b.textContent="Open lesson";
    b.onclick=()=>openLesson(c.id,l.id);row.append(name,b);panel.append(row);
  }
}
async function openLesson(courseId,lessonId){
  try{
    const l=await api(`/api/courses/${courseId}/lessons/${lessonId}`);
    const panel=$("lessonPanel");panel.innerHTML="";
    const back=document.createElement("button");back.className="outline";back.textContent="← Back to lessons";back.onclick=()=>openCourse(courseId);
    const h=document.createElement("h2");h.textContent=l.title;
    const content=document.createElement("div");content.className="lesson-content";content.textContent=l.content;
    const done=document.createElement("button");done.className="primary";done.textContent=l.completed?"✓ Completed":"Mark as completed";done.disabled=l.completed;
    done.onclick=async()=>{try{const r=await api(`/api/lessons/${lessonId}/complete`,{method:"POST"});done.textContent="✓ Completed";done.disabled=true;alert(r.message)}catch(e){alert(e.message)}};
    panel.append(back,h,content,done);panel.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){alert(e.message)}
}
async function showMyCourses(){
  if(!user){openModal("login");return}
  $("sectionTitle").textContent="My learning";$("sectionSub").textContent="Continue your enrolled courses and track lesson progress.";
  $("myCoursesNav").classList.add("active");$("browseNav").classList.remove("active");$("lessonPanel").classList.add("hidden");$("searchInput").classList.add("hidden");
  try{
    const courses=await api("/api/my-courses");$("courseGrid").innerHTML="";
    if(!courses.length){$("courseGrid").innerHTML='<div class="empty">You have not enrolled in any courses yet. Explore courses to get started.</div>';return}
    courses.forEach(c=>{
      const card=document.createElement("article");card.className="course-card";
      const banner=document.createElement("div");banner.className="course-banner";banner.textContent=c.category;
      const body=document.createElement("div");body.className="course-body";
      const h=document.createElement("h3");h.textContent=c.title;
      const p=document.createElement("p");p.className="course-desc";p.textContent=c.description;
      const meta=document.createElement("div");meta.className="course-meta";meta.textContent=`Progress: ${c.completed_count}/${c.lesson_count} lessons`;
      const btn=document.createElement("button");btn.className="primary";btn.textContent="Continue learning";btn.onclick=()=>openCourse(c.id);
      body.append(h,p,meta,btn);card.append(banner,body);$("courseGrid").append(card);
    });
  }catch(e){$("courseGrid").innerHTML=`<div class="empty">${e.message}</div>`}
}
$("browseNav").onclick=showBrowse;$("myCoursesNav").onclick=showMyCourses;
$("exploreBtn").onclick=()=>$("sectionTitle").scrollIntoView({behavior:"smooth"});
$("searchInput").addEventListener("input",loadCourses);

$("addLessonBtn").onclick=()=>{
  const count=$$("lesson-title").length+1;
  const div=document.createElement("div");div.className="lesson-input";
  const title=document.createElement("input");title.className="lesson-title";title.placeholder=`Lesson ${count} title`;title.required=true;
  const content=document.createElement("textarea");content.className="lesson-content";content.placeholder=`Lesson ${count} content`;content.required=true;
  div.append(title,content);$("lessonFields").append(div);
};
function $$(cls){return Array.from(document.getElementsByClassName(cls))}
$("courseForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target;
  const lessons=$$("lesson-input").map(x=>({title:x.querySelector(".lesson-title").value,content:x.querySelector(".lesson-content").value}));
  const body={title:f.title.value,category:f.category.value,instructor:f.instructor.value,duration:f.duration.value,level:f.level.value,description:f.description.value,lessons};
  try{const r=await api("/api/admin/courses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});message("adminMessage",r.message,true);f.reset();$("lessonFields").innerHTML='<div class="lesson-input"><input placeholder="Lesson 1 title" class="lesson-title" required><textarea placeholder="Lesson 1 content" class="lesson-content" required></textarea></div>';loadCourses()}
  catch(err){message("adminMessage",err.message)}
});
updateAccount();loadCourses();
