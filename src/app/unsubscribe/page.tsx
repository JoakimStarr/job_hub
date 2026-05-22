'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const alertId = searchParams.get('alert_id');
  const email = searchParams.get('email');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(true);

  useEffect(() => {
    if (!alertId || !email) {
      setShowConfirm(false);
      setMessage('缺少必要参数，无法取消订阅');
    }
  }, [alertId, email]);

  const handleUnsubscribe = async () => {
    if (!alertId || !email) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/alerts/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: parseInt(alertId, 10),
          email,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setMessage('您已成功取消订阅，将不再收到相关职位提醒邮件。');
        if (data.keywords) {
          setKeywords(data.keywords);
        }
      } else {
        setSuccess(false);
        setMessage(data.error || '取消订阅失败，请稍后重试');
      }
    } catch (error) {
      setSuccess(false);
      setMessage('网络错误，请稍后重试');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 20,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 40,
        maxWidth: 500,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: success === true ? '#10b981' : success === false ? '#ef4444' : '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 40,
          }}>
            {success === true ? '✓' : success === false ? '✗' : '📧'}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#1f2937' }}>
            职位提醒取消订阅
          </h1>
        </div>

        {showConfirm ? (
          <div>
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: 14 }}>
                ⚠️ 您确定要取消订阅吗？
              </p>
              <p style={{ margin: '8px 0 0', color: '#92400e', fontSize: 13 }}>
                取消后将不再收到匹配职位的邮件提醒。
              </p>
            </div>
            
            <div style={{
              background: '#f3f4f6',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                订阅邮箱：<strong style={{ color: '#1f2937' }}>{email}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleUnsubscribe}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: loading ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? '处理中...' : '确认取消订阅'}
              </button>
              <button
                onClick={() => window.close()}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                返回
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{
              textAlign: 'center',
              color: success ? '#059669' : '#dc2626',
              fontSize: 16,
              lineHeight: 1.6,
            }}>
              {message}
            </p>
            
            {success && keywords.length > 0 && (
              <div style={{
                marginTop: 20,
                padding: 16,
                background: '#f3f4f6',
                borderRadius: 8,
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                  已取消的关键词订阅：
                </p>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {keywords.map((keyword, index) => (
                    <span
                      key={index}
                      style={{
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 13,
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {success && (
              <div style={{
                marginTop: 24,
                padding: 16,
                background: '#eff6ff',
                borderRadius: 8,
                border: '1px solid #3b82f6',
              }}>
                <p style={{ margin: 0, color: '#1e40af', fontSize: 13 }}>
                  💡 如需重新订阅，请登录系统在"职位提醒"页面创建新的订阅。
                </p>
              </div>
            )}

            <button
              onClick={() => window.close()}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '14px 24px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              关闭页面
            </button>
          </div>
        )}

        <div style={{
          marginTop: 30,
          paddingTop: 20,
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 12 }}>
            © {new Date().getFullYear()} Job Hub 职位提醒服务
          </p>
        </div>
      </div>
    </div>
  );
}
