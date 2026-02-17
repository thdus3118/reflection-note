import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface ApiKeySettingsProps {
  userId: string;
}

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ userId }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadApiKey();
  }, [userId]);

  const loadApiKey = async () => {
    const { data } = await supabase
      .from('users')
      .select('gemini_api_key')
      .eq('id', userId)
      .single();
    
    if (data?.gemini_api_key && data.gemini_api_key !== 'PLACEHOLDER_API_KEY') {
      setApiKey('••••••••••••••••••••••••••••••••••••••••');
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim() || apiKey.includes('•')) return;
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ gemini_api_key: apiKey.trim() })
        .eq('id', userId);

      if (error) {
        console.error('Supabase error:', error);
        setMessage('저장 실패: ' + error.message);
      } else {
        setMessage('API 키가 저장되었습니다.');
        setApiKey('••••••••••••••••••••••••••••••••••••••••');
        // 부모 컴포넌트에 알림
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setMessage('저장 중 오류가 발생했습니다.');
    }
    
    setIsLoading(false);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', margin: '10px 0' }}>
      <h3>Gemini API 키 설정</h3>
      <p style={{ fontSize: '14px', color: '#666' }}>
        AI 피드백 기능을 사용하려면 개인 Gemini API 키를 설정해주세요.
      </p>
      <div style={{ marginBottom: '10px' }}>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Gemini API 키를 입력하세요"
          style={{ width: '300px', padding: '8px', marginRight: '10px' }}
        />
        <button 
          onClick={saveApiKey} 
          disabled={isLoading}
          style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {isLoading ? '저장 중...' : '저장'}
        </button>
      </div>
      {message && <p style={{ color: message.includes('실패') ? 'red' : 'green' }}>{message}</p>}
    </div>
  );
};