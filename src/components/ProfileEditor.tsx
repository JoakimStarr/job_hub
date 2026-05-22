'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ResumeProfile, Education, Internship, Project } from '@/types';
import { API } from '@/lib/api';
import styles from './profile-editor.module.css';

interface ProfileEditorProps {
  initialProfile?: ResumeProfile | null;
  onProfileUpdate?: (profile: ResumeProfile) => void;
  readOnly?: boolean;
}

export default function ProfileEditor({ 
  initialProfile, 
  onProfileUpdate,
  readOnly = false 
}: ProfileEditorProps) {
  const [profile, setProfile] = useState<ResumeProfile>(initialProfile || {
    name: '',
    phone: '',
    email: '',
    education: [],
    skills: [],
    internships: [],
    projects: [],
    certifications: [],
    languages: [],
    resumeText: '',
  });

  const [additionalFields, setAdditionalFields] = useState({
    targetLocation: '',
    targetSalary: '',
    targetIndustry: '',
    jobTypePreference: '',
    selfEvaluation: '',
    availability: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!initialProfile) {
      loadCurrentProfile();
    }
  }, [initialProfile]);

  const loadCurrentProfile = async () => {
    setIsLoading(true);
    try {
      const response = await API.request<{ profile: ResumeProfile | null; hasProfile: boolean }>('/api/profile');
      if (response.profile) {
        setProfile(response.profile);
        if (onProfileUpdate) onProfileUpdate(response.profile);
      }
    } catch (error) {
      console.error('加载画像失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBasicField = (field: keyof ResumeProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const updateAdditionalField = (field: string, value: string) => {
    setAdditionalFields(prev => ({ ...prev, [field]: value }));
  };

  const addEducation = () => {
    const newEducation: Education = {
      school: '',
      major: '',
      degree: '本科',
      graduationYear: new Date().getFullYear(),
      startDate: '',
      endDate: '',
    };
    setProfile(prev => ({
      ...prev,
      education: [...prev.education, newEducation],
    }));
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    setProfile(prev => ({
      ...prev,
      education: prev.education.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu
      ),
    }));
  };

  const removeEducation = (index: number) => {
    setProfile(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const addSkill = () => {
    const skillInput = document.getElementById('new-skill-input') as HTMLInputElement;
    if (skillInput && skillInput.value.trim()) {
      const newSkill = skillInput.value.trim();
      if (!profile.skills.includes(newSkill)) {
        setProfile(prev => ({
          ...prev,
          skills: [...prev.skills, newSkill],
        }));
      }
      skillInput.value = '';
    }
  };

  const removeSkill = (index: number) => {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const addInternship = () => {
    const newInternship: Internship = {
      company: '',
      position: '',
      duration: '',
      description: '',
      startDate: '',
      endDate: '',
    };
    setProfile(prev => ({
      ...prev,
      internships: [...prev.internships, newInternship],
    }));
  };

  const updateInternship = (index: number, field: keyof Internship, value: string) => {
    setProfile(prev => ({
      ...prev,
      internships: prev.internships.map((intern, i) =>
        i === index ? { ...intern, [field]: value } : intern
      ),
    }));
  };

  const removeInternship = (index: number) => {
    setProfile(prev => ({
      ...prev,
      internships: prev.internships.filter((_, i) => i !== index),
    }));
  };

  const addProject = () => {
    const newProject: Project = {
      name: '',
      role: '',
      description: '',
    };
    setProfile(prev => ({
      ...prev,
      projects: [...prev.projects, newProject],
    }));
  };

  const updateProject = (index: number, field: keyof Project, value: string) => {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.map((proj, i) =>
        i === index ? { ...proj, [field]: value } : proj
      ),
    }));
  };

  const removeProject = (index: number) => {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          ...additionalFields,
        }),
      });
      
      if (!response.ok) throw new Error('保存失败');
      const updatedProfile = await response.json();

      if (onProfileUpdate) onProfileUpdate(updatedProfile);
      
      setMessage({
        type: 'success',
        text: '✅ 画像保存成功！',
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>加载中...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>👤 用户画像编辑器</h2>
        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? '保存中...' : '💾 保存画像'}
          </button>
        )}
      </div>

      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      <div className={styles.section}>
        <h3>📝 基本信息</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>姓名 *</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateBasicField('name', e.target.value)}
              placeholder="请输入姓名"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>电话 *</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => updateBasicField('phone', e.target.value)}
              placeholder="手机号码"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>邮箱 *</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => updateBasicField('email', e.target.value)}
              placeholder="email@example.com"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>🎓 教育经历</h3>
        {profile.education.map((edu, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>教育 #{index + 1}</span>
              {!readOnly && (
                <button
                  onClick={() => removeEducation(index)}
                  className={styles.removeButton}
                >
                  ✕ 删除
                </button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>学校</label>
                <input
                  type="text"
                  value={edu.school}
                  onChange={(e) => updateEducation(index, 'school', e.target.value)}
                  placeholder="学校名称"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.field}>
                <label>专业</label>
                <input
                  type="text"
                  value={edu.major}
                  onChange={(e) => updateEducation(index, 'major', e.target.value)}
                  placeholder="专业名称"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.field}>
                <label>学位</label>
                <select
                  value={edu.degree}
                  onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                  disabled={readOnly}
                >
                  <option value="博士">博士</option>
                  <option value="硕士">硕士</option>
                  <option value="本科">本科</option>
                  <option value="专科">专科</option>
                </select>
              </div>

              <div className={styles.field}>
                <label>毕业年份</label>
                <input
                  type="number"
                  value={edu.graduationYear || ''}
                  onChange={(e) => updateEducation(index, 'graduationYear', parseInt(e.target.value))}
                  placeholder="2026"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        ))}
        
        {!readOnly && (
          <button onClick={addEducation} className={styles.addButton}>
            + 添加教育经历
          </button>
        )}
      </div>

      <div className={styles.section}>
        <h3>💼 技能标签</h3>
        <div className={styles.tagsContainer}>
          {profile.skills.map((skill, index) => (
            <span key={index} className={styles.tag}>
              {skill}
              {!readOnly && (
                <button onClick={() => removeSkill(index)} className={styles.tagRemove}>
                  ✕
                </button>
              )}
            </span>
          ))}
          
          {!readOnly && (
            <div className={styles.tagInput}>
              <input
                id="new-skill-input"
                type="text"
                placeholder="输入技能后按回车或点击添加"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <button onClick={addSkill} className={styles.addTagButton}>
                添加
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h3>🏢 实习/工作经历</h3>
        {profile.internships.map((intern, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>经历 #{index + 1}</span>
              {!readOnly && (
                <button
                  onClick={() => removeInternship(index)}
                  className={styles.removeButton}
                >
                  ✕ 删除
                </button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>公司名称</label>
                <input
                  type="text"
                  value={intern.company}
                  onChange={(e) => updateInternship(index, 'company', e.target.value)}
                  placeholder="公司名称"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.field}>
                <label>职位</label>
                <input
                  type="text"
                  value={intern.position}
                  onChange={(e) => updateInternship(index, 'position', e.target.value)}
                  placeholder="职位名称"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.field}>
                <label>时长</label>
                <input
                  type="text"
                  value={intern.duration}
                  onChange={(e) => updateInternship(index, 'duration', e.target.value)}
                  placeholder="如：3个月"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.fieldFull}>
                <label>工作描述</label>
                <textarea
                  value={intern.description}
                  onChange={(e) => updateInternship(index, 'description', e.target.value)}
                  placeholder="详细描述工作内容和成果..."
                  rows={3}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        ))}

        {!readOnly && (
          <button onClick={addInternship} className={styles.addButton}>
            + 添加实习/工作经历
          </button>
        )}
      </div>

      <div className={styles.section}>
        <h3>🏆 项目经历</h3>
        {profile.projects.map((proj, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>项目 #{index + 1}</span>
              {!readOnly && (
                <button
                  onClick={() => removeProject(index)}
                  className={styles.removeButton}
                >
                  ✕ 删除
                </button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>项目名称</label>
                <input
                  type="text"
                  value={proj.name}
                  onChange={(e) => updateProject(index, 'name', e.target.value)}
                  placeholder="项目名称"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.field}>
                <label>担任角色</label>
                <input
                  type="text"
                  value={proj.role}
                  onChange={(e) => updateProject(index, 'role', e.target.value)}
                  placeholder="如：负责人/核心成员"
                  disabled={readOnly}
                />
              </div>

              <div className={styles.fieldFull}>
                <label>项目描述</label>
                <textarea
                  value={proj.description}
                  onChange={(e) => updateProject(index, 'description', e.target.value)}
                  placeholder="项目背景、目标、你的贡献和成果..."
                  rows={3}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        ))}

        {!readOnly && (
          <button onClick={addProject} className={styles.addButton}>
            + 添加项目经历
          </button>
        )}
      </div>

      <div className={styles.section}>
        <h3>🎯 其他信息</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>证书资质</label>
            <input
              type="text"
              value={profile.certifications?.join(', ') || ''}
              onChange={(e) => setProfile(prev => ({
                ...prev,
                certifications: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              }))}
              placeholder="多个证书用逗号分隔，如：CFA Level 1, CPA"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>语言能力</label>
            <input
              type="text"
              value={profile.languages?.join(', ') || ''}
              onChange={(e) => setProfile(prev => ({
                ...prev,
                languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              }))}
              placeholder="如：英语CET-6, 日语N2"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>目标工作地点</label>
            <input
              type="text"
              value={additionalFields.targetLocation}
              onChange={(e) => updateAdditionalField('targetLocation', e.target.value)}
              placeholder="如：北京、上海、深圳"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>期望薪资范围</label>
            <input
              type="text"
              value={additionalFields.targetSalary}
              onChange={(e) => updateAdditionalField('targetSalary', e.target.value)}
              placeholder="如：8-12K, 15-25K"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>目标行业</label>
            <input
              type="text"
              value={additionalFields.targetIndustry}
              onChange={(e) => updateAdditionalField('targetIndustry', e.target.value)}
              placeholder="如：金融、互联网、咨询"
              disabled={readOnly}
            />
          </div>

          <div className={styles.field}>
            <label>可入职时间</label>
            <select
              value={additionalFields.availability}
              onChange={(e) => updateAdditionalField('availability', e.target.value)}
              disabled={readOnly}
            >
              <option value="">请选择</option>
              <option value="随时">随时到岗</option>
              <option value="1周内">1周内</option>
              <option value="2周内">2周内</option>
              <option value="1个月内">1个月内</option>
              <option value="毕业后">毕业后</option>
            </select>
          </div>

          <div className={styles.fieldFull}>
            <label>自我评价</label>
            <textarea
              value={additionalFields.selfEvaluation}
              onChange={(e) => updateAdditionalField('selfEvaluation', e.target.value)}
              placeholder="简要描述个人优势、特点、职业规划等..."
              rows={4}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className={styles.footer}>
          <button onClick={handleSave} disabled={isSaving} className={styles.primaryButton}>
            {isSaving ? '⏳ 保存中...' : '✅ 保存所有修改'}
          </button>
        </div>
      )}
    </div>
  );
}