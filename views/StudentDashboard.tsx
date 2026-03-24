
import React, { useState, useEffect, useRef } from 'react';
import { User, Reflection, ClassInfo, WeeklyFeedback } from '../types';
import { DB } from '../store';
import ReflectionForm from '../components/ReflectionForm';
import { aiService } from '../geminiService';

interface StudentDashboardProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onUpdateUser }) => {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [weeklyFeedbacks, setWeeklyFeedbacks] = useState<WeeklyFeedback[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<WeeklyFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [view, setView] = useState<'form' | 'history' | 'calendar' | 'feedback' | 'settings'>(user.isFirstLogin ? 'settings' : 'form');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 달력 상태
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedDateDetail, setSelectedDateDetail] = useState<Reflection | null>(null);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  const getKoreanDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };
  const today = getKoreanDate();

  useEffect(() => { refreshData(); }, [user.id, user.classId]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const refreshData = async () => {
    const allRef = await DB.getReflections();
    const myRef = allRef.filter(r => r.studentId === user.id).sort((a, b) => b.date.localeCompare(a.date));
    setReflections(myRef);
    const myClass = (await DB.getClasses()).find(c => c.id === user.classId);
    setClassInfo(myClass || null);
    if (user.classId) {
      const feedbacks = await DB.getWeeklyFeedbacks(user.id);
      setWeeklyFeedbacks(feedbacks);
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const weekStartStr = monday.toISOString().split('T')[0];
      const thisWeek = feedbacks.find(f => f.weekStart === weekStartStr);
      setLatestFeedback(thisWeek || feedbacks[0] || null);
    }
  };

  const todaysReflection = reflections.find(r => r.date === today);
  const alreadySubmitted = !!todaysReflection;

  const handleSubmit = async (data: any) => {
    // 자정 수정 금지 체크
    const now = getKoreanDate();
    if (isEditing && todaysReflection?.date !== now) {
      alert("성찰 수정은 당일 자정까지만 가능합니다.");
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    const allReflections = await DB.getReflections();
    const existingIdx = allReflections.findIndex(r => r.studentId === user.id && r.date === today);

    let updatedReflection: Reflection;
    if (existingIdx > -1) {
      updatedReflection = { ...allReflections[existingIdx], ...data, updatedAt: new Date().toISOString() };
    } else {
      updatedReflection = { id: crypto.randomUUID(), studentId: user.id, date: today, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }

    // 즉시 저장 (AI 피드백 없이)
    let nextAllReflections;
    if (existingIdx > -1) {
      nextAllReflections = allReflections.map((r, idx) => idx === existingIdx ? updatedReflection : r);
    } else {
      nextAllReflections = [updatedReflection, ...allReflections];
    }

    await DB.setReflections(nextAllReflections);
    await refreshData();
    setIsSubmitting(false);
    setIsEditing(false);
    setSuccessMessage("성찰 노트가 성공적으로 제출되었습니다!");

    // AI 피드백은 백그라운드에서 비동기 처리 (속도 개선)
    (async () => {
      try {
        const aiRes = await aiService.getEncouragingFeedback(updatedReflection, user.classId, latestFeedback?.feedback);
        if (aiRes.feedback && !aiRes.feedback.includes('API 사용량')) {
          const latestReflections = await DB.getReflections();
          const targetIdx = latestReflections.findIndex(r => r.id === updatedReflection.id);
          if (targetIdx > -1) {
            latestReflections[targetIdx].aiFeedback = aiRes.feedback;
            latestReflections[targetIdx].sentiment = aiRes.sentiment as any;
            await DB.setReflections(latestReflections);
            await refreshData();
          }
        }
      } catch (e) { 
        console.error('AI 피드백 생성 실패:', e);
      }
    })();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.current !== user.passwordHash) { alert("현재 비밀번호가 일치하지 않습니다."); return; }
    if (passwords.next !== passwords.confirm) { alert("비밀번호 확인이 일치하지 않습니다."); return; }
    
    // 학생 비밀번호 규칙: 4자리 이상 숫자
    if (!/^\d{4,}$/.test(passwords.next)) {
      alert("비밀번호는 4자리 이상의 숫자여야 합니다.");
      return;
    }

    const updatedUser = { ...user, passwordHash: passwords.next, isFirstLogin: false };
    const nextUsers = (await DB.getUsers()).map(u => u.id === user.id ? updatedUser : u);
    await DB.setUsers(nextUsers);
    onUpdateUser(updatedUser);
    setSuccessMessage("비밀번호가 안전하게 변경되었습니다.");
    setPasswords({ current: '', next: '', confirm: '' });
    if (view === 'settings') setView('form');
  };

  // 데이터 백업 (JSON 다운로드)
  const handleExportJSON = () => {
    const data = {
      studentId: user.studentId,
      studentName: user.name,
      reflections: reflections
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `성찰노트_${user.name}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 데이터 복원 (JSON 업로드)
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.studentId !== user.studentId) {
          alert("로그인된 학생과 백업 파일의 학생 정보가 일치하지 않습니다.");
          return;
        }

        const allReflections = await DB.getReflections();
        let addedCount = 0;
        const newReflections = [...allReflections];

        data.reflections.forEach((r: Reflection) => {
          const exists = allReflections.some(existing => existing.studentId === user.id && existing.date === r.date);
          if (!exists) {
            newReflections.push({ ...r, studentId: user.id }); // merge 방식: 없는 날짜만 추가
            addedCount++;
          }
        });

        if (confirm(`${addedCount}건의 새 성찰이 발견되었습니다. 복원하시겠습니까?`)) {
          DB.setReflections(newReflections);
          refreshData();
          setSuccessMessage(`${addedCount}건의 기록이 성공적으로 복원되었습니다.`);
        }
      } catch (err) {
        alert("올바르지 않은 JSON 파일입니다.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const changeMonth = (offset: number) => {
    let nextMonth = calMonth + offset;
    let nextYear = calYear;
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    if (nextMonth < 0) { nextMonth = 11; nextYear--; }
    setCalMonth(nextMonth);
    setCalYear(nextYear);
  };

  const renderCalendar = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm animate-in fade-in duration-500">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">◀</button>
            <h3 className="text-xl font-black text-slate-800">{calYear}년 {calMonth + 1}월</h3>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">▶</button>
          </div>
          <div className="flex gap-4 text-[10px] font-bold">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-600 rounded-full"></span> 완료</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-100 rounded-full"></span> 미작성</div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-3">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-400 pb-4 uppercase tracking-widest">{d}</div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-16"></div>;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = reflections.find(r => r.date === dateStr);
            const isToday = dateStr === today;
            return (
              <button 
                key={day} 
                onClick={() => record && setSelectedDateDetail(record)}
                className={`h-16 rounded-2xl flex items-center justify-center relative transition-all border-2 ${record ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg cursor-pointer hover:scale-105 active:scale-95' : 'bg-slate-50 border-transparent text-slate-400 cursor-default'} ${isToday ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
              >
                <span className="text-sm font-black">{day}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (user.isFirstLogin) {
    return (
      <div className="max-w-xl mx-auto space-y-8 py-12 animate-in slide-in-from-bottom-4">
        <div className="bg-white p-12 rounded-[3rem] border border-indigo-100 shadow-2xl space-y-10 text-center">
          <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto text-4xl">🔐</div>
          <div className="space-y-3">
            <h3 className="text-3xl font-black text-slate-800">보안을 위해 비밀번호를 변경해주세요</h3>
            <p className="text-sm text-slate-400 font-bold leading-relaxed">최초 로그인 시 비밀번호 변경이 필수입니다.<br/>4자리 이상의 숫자로 설정해주세요.</p>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4 text-left">
            <input type="password" placeholder="현재 비밀번호 (기초: 0000)" required value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
            <input type="password" placeholder="새 비밀번호 (4자리 이상 숫자)" required value={passwords.next} onChange={e => setPasswords({...passwords, next: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
            <input type="password" placeholder="새 비밀번호 확인" required value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
            <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">비밀번호 변경 및 시작하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 pb-20 animate-in fade-in duration-500">
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
          {successMessage}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tight">{user.name} 학생 👋</h2>
          <p className="text-indigo-100 opacity-80 font-bold text-lg">{user.studentId} | {classInfo?.name || '학급 정보 없음'}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/20">
          <div className="text-[10px] font-black tracking-widest opacity-60 mb-1 uppercase">성찰 참여도</div>
          <div className="text-5xl font-black leading-none">{classInfo ? Math.round((reflections.length / classInfo.targetDays) * 100) : 0}%</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-hide">
        {[
          { id: 'form', label: '오늘 성찰', icon: '📝' },
          { id: 'history', label: '누적 기록', icon: '📖' },
          { id: 'calendar', label: '현황 달력', icon: '📅' },
          { id: 'feedback', label: 'AI 피드백', icon: '🤖' },
          { id: 'settings', label: '개인 설정', icon: '⚙️' }
        ].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id as any); setIsEditing(false); }} className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-sm font-black transition-all whitespace-nowrap ${view === tab.id ? 'bg-slate-800 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-200'}`}>
            <span className="text-lg">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {view === 'form' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {latestFeedback && (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full">💡 이번 주 성찰 가이드</span>
                  <span className="text-xs text-white/60 font-bold">{latestFeedback.weekStart} ~ {latestFeedback.weekEnd}</span>
                </div>
                <p className="text-sm font-bold leading-relaxed text-white/90">{latestFeedback.feedback}</p>
                <button onClick={() => setView('feedback')} className="mt-4 text-xs font-black text-white/70 hover:text-white underline">이전 피드백 모두 보기 →</button>
              </div>
            </div>
          )}
          {alreadySubmitted && !isEditing ? (
            <div className="bg-white border p-12 rounded-[3rem] text-center space-y-8 shadow-sm">
              <div className="bg-emerald-100 text-emerald-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto text-5xl">✓</div>
              <h3 className="text-3xl font-black text-slate-800">성찰 제출 완료!</h3>
              {todaysReflection?.aiFeedback && (
                 <div className="bg-indigo-50 p-8 rounded-[2.5rem] text-left border border-indigo-100 relative mt-4">
                    <span className="absolute -top-3 left-10 bg-indigo-600 text-[10px] text-white font-black px-4 py-1.5 rounded-full">AI 격려</span>
                    <p className="text-indigo-900 leading-relaxed font-bold italic">"{todaysReflection.aiFeedback}"</p>
                 </div>
              )}
              {todaysReflection?.teacherFeedback && (
                 <div className="bg-amber-50 p-8 rounded-[2.5rem] text-left border border-amber-200 relative mt-4">
                    <span className="absolute -top-3 left-10 bg-amber-500 text-[10px] text-white font-black px-4 py-1.5 rounded-full">선생님 말씀</span>
                    <p className="text-amber-900 leading-relaxed font-bold">"{todaysReflection.teacherFeedback}"</p>
                 </div>
              )}
              <button onClick={() => setIsEditing(true)} className="w-full bg-slate-800 text-white py-6 rounded-2xl font-black hover:bg-black transition-colors">내용 수정하기 (오늘 한정)</button>
            </div>
          ) : (
            <ReflectionForm onSubmit={handleSubmit} isSubmitting={isSubmitting} initialData={isEditing ? todaysReflection : undefined} onCancel={isEditing ? () => setIsEditing(false) : undefined} />
          )}
        </div>
      )}

      {view === 'history' && (
        <div className="grid gap-6 animate-in slide-in-from-bottom-8">
          {reflections.map(r => (
            <div key={r.id} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
               <div className="flex justify-between items-center"><span className="text-sm font-black text-slate-300">{r.date}</span><div className="flex text-amber-400 text-xl">{'★'.repeat(r.attitudeRating)}</div></div>
               <div className="grid md:grid-cols-3 gap-8 text-sm font-bold text-slate-700 leading-relaxed">
                  <div><label className="text-[10px] font-black text-slate-300 block mb-1 uppercase tracking-widest">학습 내용</label>{r.learnedContent}</div>
                  <div><label className="text-[10px] font-black text-slate-300 block mb-1 uppercase tracking-widest">학습 활동</label>{r.activities}</div>
                  <div><label className="text-[10px] font-black text-slate-300 block mb-1 uppercase tracking-widest">협동 성찰</label>{r.collaboration}</div>
               </div>
               {r.teacherFeedback && (
                 <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                   <label className="text-[10px] font-black text-amber-500 block mb-2 tracking-widest uppercase">선생님 피드백</label>
                   <p className="text-sm font-black text-amber-900 leading-relaxed">{r.teacherFeedback}</p>
                 </div>
               )}
            </div>
          ))}
          {reflections.length === 0 && <div className="py-24 text-center font-black text-slate-200 text-2xl border-4 border-dashed rounded-[3rem]">아직 기록이 없습니다.</div>}
        </div>
      )}

      {view === 'feedback' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8">
          <h3 className="text-xl font-black text-slate-800 px-2">🤖 AI 주간 피드백 누적 기록</h3>
          {weeklyFeedbacks.length === 0 ? (
            <div className="py-24 text-center font-black text-slate-200 text-2xl border-4 border-dashed rounded-[3rem]">아직 피드백이 없습니다.</div>
          ) : (
            weeklyFeedbacks.map(fb => (
              <div key={fb.id} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black bg-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full">{fb.weekStart} ~ {fb.weekEnd}</span>
                </div>
                <p className="text-slate-700 font-bold leading-relaxed text-sm">{fb.feedback}</p>
              </div>
            ))
          )}
        </div>
      )}

      {view === 'calendar' && renderCalendar()}

      {view === 'settings' && (
        <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-2xl font-black text-slate-800">개인 보안 설정</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <input type="password" placeholder="현재 비밀번호" required value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <input type="password" placeholder="새 비밀번호 (4자리 숫자)" required value={passwords.next} onChange={e => setPasswords({...passwords, next: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <input type="password" placeholder="새 비밀번호 확인" required value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700">비밀번호 변경</button>
            </form>
          </div>

          <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-800">데이터 백업 및 복원</h3>
              <p className="text-sm text-slate-400 font-bold leading-relaxed">자신의 성찰 데이터를 보관하거나 기기 이동 시 복원할 수 있습니다.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <button onClick={handleExportJSON} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-6 rounded-2xl font-black hover:bg-slate-200 transition-all">
                📥 데이터 백업하기
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-6 rounded-2xl font-black hover:bg-black transition-all">
                📤 데이터 복원하기
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
            </div>
          </div>
        </div>
      )}

      {/* 날짜 상세 팝업 */}
      {selectedDateDetail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setSelectedDateDetail(null)}></div>
           <div className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-2xl font-black text-slate-800">{selectedDateDetail.date} 성찰</h4>
                  <div className="text-amber-400 text-xl mt-1">{'★'.repeat(selectedDateDetail.attitudeRating)}</div>
                </div>
                <button onClick={() => setSelectedDateDetail(null)} className="p-4 hover:bg-slate-100 rounded-full transition-colors">✕</button>
              </div>
              <div className="space-y-6 text-sm font-bold text-slate-600 leading-relaxed">
                <p><span className="text-[10px] font-black text-slate-300 block uppercase tracking-widest mb-1">학습 내용</span>{selectedDateDetail.learnedContent}</p>
                <p><span className="text-[10px] font-black text-slate-300 block uppercase tracking-widest mb-1">학습 활동</span>{selectedDateDetail.activities}</p>
                <p><span className="text-[10px] font-black text-slate-300 block uppercase tracking-widest mb-1">협동 성찰</span>{selectedDateDetail.collaboration}</p>
              </div>
              {selectedDateDetail.teacherFeedback && (
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                   <label className="text-[10px] font-black text-amber-500 block mb-2 uppercase">선생님 피드백</label>
                   <p className="text-sm font-black text-amber-900 italic">"{selectedDateDetail.teacherFeedback}"</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
