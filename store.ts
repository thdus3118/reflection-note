import { supabase } from './supabaseClient';
import { User, Reflection, ClassInfo, UserRole } from './types';

// 세션 관리는 localStorage 유지 (클라이언트 측)
const SESSION_KEY = 'reflection_note_session_v2';

export const DB = {
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(u => ({
      id: u.id,
      role: u.role as UserRole,
      name: u.name,
      loginId: u.login_id,
      studentId: u.student_id,
      classId: u.class_id,
      passwordHash: u.password_hash,
      isFirstLogin: u.is_first_login,
      isActive: u.is_active
    }));
  },

  setUsers: async (users: User[]) => {
    const updates = users.map(u => ({
      id: u.id,
      role: u.role,
      name: u.name,
      login_id: u.loginId,
      student_id: u.studentId,
      class_id: u.classId,
      password_hash: u.passwordHash,
      is_first_login: u.isFirstLogin,
      is_active: u.isActive
    }));
    const { error } = await supabase.from('users').upsert(updates);
    if (error) throw error;
  },

  getReflections: async (): Promise<Reflection[]> => {
    const { data, error } = await supabase
      .from('reflections')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data.map(r => ({
      id: r.id,
      studentId: r.student_id,
      date: r.date,
      attitudeRating: r.attitude_rating,
      learnedContent: r.learned_content,
      activities: r.activities,
      collaboration: r.collaboration,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      aiFeedback: r.ai_feedback,
      sentiment: r.sentiment,
      teacherFeedback: r.teacher_feedback
    }));
  },

  setReflections: async (data: Reflection[]) => {
    const records = data.map(r => ({
      id: r.id,
      student_id: r.studentId,
      date: r.date,
      attitude_rating: r.attitudeRating,
      learned_content: r.learnedContent,
      activities: r.activities,
      collaboration: r.collaboration,
      ai_feedback: r.aiFeedback,
      sentiment: r.sentiment,
      teacher_feedback: r.teacherFeedback,
      created_at: r.createdAt,
      updated_at: r.updatedAt
    }));
    const { error } = await supabase.from('reflections').upsert(records);
    if (error) throw error;
  },

  getClasses: async (): Promise<ClassInfo[]> => {
    const { data, error } = await supabase.from('classes').select('*');
    if (error) throw error;
    return data.map(c => ({
      id: c.id,
      name: c.name,
      year: c.year,
      teacherId: c.teacher_id,
      targetDays: c.target_days
    }));
  },

  setClasses: async (data: ClassInfo[]) => {
    const records = data.map(c => ({
      id: c.id,
      name: c.name,
      year: c.year,
      teacher_id: c.teacherId,
      target_days: c.targetDays
    }));
    const { error } = await supabase.from('classes').upsert(records);
    if (error) throw error;
  },

  getAnalyses: async (): Promise<Record<string, any>> => {
    const { data, error } = await supabase.from('analyses').select('*');
    if (error) throw error;
    return data.reduce((acc, item) => ({ ...acc, [item.key]: item.result }), {});
  },

  setAnalysis: async (key: string, result: any) => {
    const { error } = await supabase.from('analyses').upsert({
      key,
      result: { ...result, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
    if (error) throw error;
  },

  deleteAnalysis: async (key: string) => {
    const { error } = await supabase.from('analyses').delete().eq('key', key);
    if (error) throw error;
  },

  getCurrentUser: (): User | null => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'),
  
  setCurrentUser: (user: User | null) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  },

  updateReflectionFeedback: async (reflectionId: string, feedback: string) => {
    const { error } = await supabase.from('reflections').update({
      teacher_feedback: feedback,
      updated_at: new Date().toISOString()
    }).eq('id', reflectionId);
    if (error) throw error;
  },

  addTeacher: async (teacherData: { name: string, loginId: string, passwordHash: string }) => {
    const { error } = await supabase.from('users').insert({
      role: UserRole.TEACHER,
      name: teacherData.name,
      login_id: teacherData.loginId,
      password_hash: teacherData.passwordHash,
      is_first_login: true,
      is_active: true
    });
    if (error) throw error;
  },

  deactivateUser: async (userId: string) => {
    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', userId);
    if (error) throw error;
  },

  reactivateUser: async (userId: string) => {
    const { error } = await supabase.from('users').update({ is_active: true }).eq('id', userId);
    if (error) throw error;
  },

  resetUserPassword: async (userId: string) => {
    const { error } = await supabase.from('users').update({
      password_hash: '0000',
      is_first_login: true
    }).eq('id', userId);
    if (error) throw error;
  },

  upsertStudent: async (studentData: Partial<User>) => {
    if (!studentData.id) {
      const { data: existing } = await supabase.from('users').select('id').eq('role', UserRole.STUDENT).eq('class_id', studentData.classId).eq('student_id', studentData.studentId).eq('is_active', true).maybeSingle();
      if (existing) throw new Error(`학번 ${studentData.studentId}이(가) 이미 존재합니다.`);
      
      const { error } = await supabase.from('users').insert({
        role: UserRole.STUDENT,
        name: studentData.name || '',
        student_id: studentData.studentId || '',
        login_id: '',
        password_hash: '0000',
        is_first_login: true,
        is_active: true,
        class_id: studentData.classId
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('users').update({
        name: studentData.name,
        student_id: studentData.studentId,
        class_id: studentData.classId
      }).eq('id', studentData.id);
      if (error) throw error;
    }
  },

  bulkUpsertStudents: async (students: { name: string, studentId: string, classId: string }[]) => {
    const duplicates: string[] = [];
    const studentIds = students.map(s => s.studentId);
    
    const { data: existingList } = await supabase
      .from('users')
      .select('student_id')
      .eq('role', UserRole.STUDENT)
      .eq('class_id', students[0].classId)
      .in('student_id', studentIds)
      .eq('is_active', true);
    
    const existingIds = new Set(existingList?.map(e => e.student_id) || []);
    
    const validStudents = students
      .filter(s => {
        if (existingIds.has(s.studentId)) {
          duplicates.push(s.studentId);
          return false;
        }
        return true;
      })
      .map(s => ({
        role: UserRole.STUDENT,
        name: s.name,
        student_id: s.studentId,
        login_id: '',
        password_hash: '0000',
        is_first_login: true,
        is_active: true,
        class_id: s.classId
      }));

    if (validStudents.length > 0) {
      const { error } = await supabase.from('users').insert(validStudents);
      if (error) throw error;
    }

    return { count: validStudents.length, duplicates };
  },

  resetStudentPassword: async (studentId: string) => {
    await DB.resetUserPassword(studentId);
  },

  deleteClass: async (classId: string) => {
    // 학급에 학생이 있는지 확인 (비활성화 포함)
    const { data: students } = await supabase
      .from('users')
      .select('id')
      .eq('class_id', classId)
      .eq('role', UserRole.STUDENT);
    
    if (students && students.length > 0) {
      throw new Error('학급에 등록된 학생이 있습니다.');
    }
    
    const { error: classError } = await supabase.from('classes').delete().eq('id', classId);
    if (classError) throw classError;
  },

  init: async () => {
    const users = await DB.getUsers();
    const hasAdmin = users.some(u => u.role === UserRole.ADMIN);
    const currentYear = new Date().getFullYear().toString();

    if (!hasAdmin) {
      const { data: teacher, error: teacherError } = await supabase.from('users').insert({
        role: UserRole.TEACHER,
        name: '김선생님',
        login_id: 'teacher1',
        password_hash: '0000',
        is_first_login: false,
        is_active: true
      }).select().single();
      if (teacherError) throw teacherError;

      const { data: classData, error: classError } = await supabase.from('classes').insert({
        name: '1학년 3반',
        year: currentYear,
        teacher_id: teacher.id,
        target_days: 190
      }).select().single();
      if (classError) throw classError;

      await supabase.from('users').insert([
        {
          role: UserRole.ADMIN,
          name: '시스템 관리자',
          login_id: 'admin',
          password_hash: '0000',
          is_first_login: true,
          is_active: true
        },
        {
          role: UserRole.STUDENT,
          name: '홍길동',
          student_id: '10301',
          login_id: '',
          password_hash: '0000',
          is_first_login: true,
          is_active: true,
          class_id: classData.id
        }
      ]);
    }
  }
};
