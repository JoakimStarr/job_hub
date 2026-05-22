'use client';

import { useState, useEffect } from 'react';
import type { ResumeProfile, Education, Internship, Project, Award, SocialLink } from '@/types';
import { maskPhone, maskEmail } from '@/lib/privacy';
import { API } from '@/lib/api';
import styles from './profile-editor.module.css';

interface ProfileEditorProps {
  initialProfile?: ResumeProfile | null;
  onProfileUpdate?: (profile: ResumeProfile) => void;
  readOnly?: boolean;
}

const EMPTY_PROFILE: ResumeProfile = {
  name: '',
  phone: '',
  email: '',
  gender: '',
  birthDate: '',
  age: undefined,
  address: '',
  education: [],
  skills: [],
  internships: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  volunteerExperience: '',
  socialLinks: [],
  portfolio: '',
  github: '',
  targetPosition: '',
  targetLocation: '',
  targetSalary: '',
  targetIndustry: '',
  jobTypePreference: '',
  availability: '',
  selfEvaluation: '',
  resumeText: '',
};

export default function ProfileEditor({
  initialProfile,
  onProfileUpdate,
  readOnly = false,
}: ProfileEditorProps) {
  const [profile, setProfile] = useState<ResumeProfile>(
    initialProfile ? { ...EMPTY_PROFILE, ...initialProfile } : EMPTY_PROFILE
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);

  // 关键修复：initialProfile 变化时同步更新 state
  useEffect(() => {
    if (initialProfile) {
      setProfile({ ...EMPTY_PROFILE, ...initialProfile });
    }
  }, [initialProfile]);

  const updateField = (field: keyof ResumeProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // === 教育经历 ===
  const addEducation = () => {
    const newEdu: Education = {
      school: '', major: '', degree: '本科',
      graduationYear: new Date().getFullYear(),
      startDate: '', endDate: '',
    };
    setProfile(prev => ({ ...prev, education: [...prev.education, newEdu] }));
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

  // === 技能 ===
  const addSkill = () => {
    const input = document.getElementById('new-skill-input') as HTMLInputElement;
    if (input?.value.trim()) {
      const skill = input.value.trim();
      if (!profile.skills.includes(skill)) {
        setProfile(prev => ({ ...prev, skills: [...prev.skills, skill] }));
      }
      input.value = '';
    }
  };

  const removeSkill = (index: number) => {
    setProfile(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  // === 实习经历 ===
  const addInternship = () => {
    const newIntern: Internship = {
      company: '', position: '', duration: '',
      description: '', startDate: '', endDate: '',
    };
    setProfile(prev => ({ ...prev, internships: [...prev.internships, newIntern] }));
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

  // === 项目经历 ===
  const addProject = () => {
    const newProj: Project = { name: '', role: '', description: '' };
    setProfile(prev => ({ ...prev, projects: [...prev.projects, newProj] }));
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
    setProfile(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
  };

  // === 获奖经历 ===
  const addAward = () => {
    const newAward: Award = { name: '', level: '', date: '' };
    setProfile(prev => ({ ...prev, awards: [...(prev.awards || []), newAward] }));
  };

  const updateAward = (index: number, field: keyof Award, value: string) => {
    setProfile(prev => ({
      ...prev,
      awards: (prev.awards || []).map((award, i) =>
        i === index ? { ...award, [field]: value } : award
      ),
    }));
  };

  const removeAward = (index: number) => {
    setProfile(prev => ({
      ...prev,
      awards: (prev.awards || []).filter((_, i) => i !== index),
    }));
  };

  // === 社交链接 ===
  const addSocialLink = () => {
    const newLink: SocialLink = { platform: '', url: '' };
    setProfile(prev => ({ ...prev, socialLinks: [...(prev.socialLinks || []), newLink] }));
  };

  const updateSocialLink = (index: number, field: keyof SocialLink, value: string) => {
    setProfile(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      ),
    }));
  };

  const removeSocialLink = (index: number) => {
    setProfile(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).filter((_, i) => i !== index),
    }));
  };

  // === 保存 ===
  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await API.request<{ success: boolean; profile: ResumeProfile }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });

      if (onProfileUpdate) onProfileUpdate(response.profile);
      setMessage({ type: 'success', text: '画像保存成功！' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayPhone = showSensitive ? profile.phone : maskPhone(profile.phone);
  const displayEmail = showSensitive ? profile.email : maskEmail(profile.email);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>用户画像</h2>
        <div className={styles.headerActions}>
          <button
            onClick={() => setShowSensitive(!showSensitive)}
            className={styles.toggleBtn}
            title={showSensitive ? '隐藏敏感信息' : '显示敏感信息'}
          >
            {showSensitive ? '🔒 隐藏' : '👁 显示'}隐私
          </button>
          {!readOnly && (
            <button onClick={handleSave} disabled={isSaving} className={styles.saveButton}>
              {isSaving ? '保存中...' : '保存画像'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {/* 基本信息 */}
      <div className={styles.section}>
        <h3>基本信息</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>姓名</label>
            <input type="text" value={profile.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="请输入姓名" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>性别</label>
            <select value={profile.gender || ''} onChange={(e) => updateField('gender', e.target.value)} disabled={readOnly}>
              <option value="">请选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>出生日期</label>
            <input type="date" value={profile.birthDate || ''}
              onChange={(e) => updateField('birthDate', e.target.value)} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>年龄</label>
            <input type="number" value={profile.age || ''}
              onChange={(e) => updateField('age', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="年龄" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>手机号 {showSensitive && <span className={styles.sensitiveTag}>明文</span>}</label>
            <input type="tel" value={displayPhone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="手机号码" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>邮箱 {showSensitive && <span className={styles.sensitiveTag}>明文</span>}</label>
            <input type="email" value={displayEmail}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="email@example.com" disabled={readOnly} />
          </div>
          <div className={styles.fieldFull}>
            <label>现居地址</label>
            <input type="text" value={profile.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="如：北京市海淀区" disabled={readOnly} />
          </div>
        </div>
      </div>

      {/* 教育经历 */}
      <div className={styles.section}>
        <h3>教育经历</h3>
        {profile.education.map((edu, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>教育 #{index + 1}</span>
              {!readOnly && (
                <button onClick={() => removeEducation(index)} className={styles.removeButton}>删除</button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>学校</label>
                <input type="text" value={edu.school}
                  onChange={(e) => updateEducation(index, 'school', e.target.value)}
                  placeholder="学校名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>专业</label>
                <input type="text" value={edu.major}
                  onChange={(e) => updateEducation(index, 'major', e.target.value)}
                  placeholder="专业名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>学位</label>
                <select value={edu.degree}
                  onChange={(e) => updateEducation(index, 'degree', e.target.value)} disabled={readOnly}>
                  <option value="博士">博士</option>
                  <option value="硕士">硕士</option>
                  <option value="本科">本科</option>
                  <option value="专科">专科</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>毕业年份</label>
                <input type="number" value={edu.graduationYear || ''}
                  onChange={(e) => updateEducation(index, 'graduationYear', parseInt(e.target.value))}
                  placeholder="2026" disabled={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button onClick={addEducation} className={styles.addButton}>+ 添加教育经历</button>}
      </div>

      {/* 技能标签 */}
      <div className={styles.section}>
        <h3>技能标签</h3>
        <div className={styles.tagsContainer}>
          {profile.skills.map((skill, index) => (
            <span key={index} className={styles.tag}>
              {skill}
              {!readOnly && (
                <button onClick={() => removeSkill(index)} className={styles.tagRemove}>x</button>
              )}
            </span>
          ))}
          {!readOnly && (
            <div className={styles.tagInput}>
              <input id="new-skill-input" type="text" placeholder="输入技能后回车添加"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
              <button onClick={addSkill} className={styles.addTagButton}>添加</button>
            </div>
          )}
        </div>
      </div>

      {/* 实习/工作经历 */}
      <div className={styles.section}>
        <h3>实习/工作经历</h3>
        {profile.internships.map((intern, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>经历 #{index + 1}</span>
              {!readOnly && (
                <button onClick={() => removeInternship(index)} className={styles.removeButton}>删除</button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>公司名称</label>
                <input type="text" value={intern.company}
                  onChange={(e) => updateInternship(index, 'company', e.target.value)}
                  placeholder="公司名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>职位</label>
                <input type="text" value={intern.position}
                  onChange={(e) => updateInternship(index, 'position', e.target.value)}
                  placeholder="职位名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>时长</label>
                <input type="text" value={intern.duration}
                  onChange={(e) => updateInternship(index, 'duration', e.target.value)}
                  placeholder="如：3个月" disabled={readOnly} />
              </div>
              <div className={styles.fieldFull}>
                <label>工作描述</label>
                <textarea value={intern.description}
                  onChange={(e) => updateInternship(index, 'description', e.target.value)}
                  placeholder="详细描述工作内容和成果..." rows={3} disabled={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button onClick={addInternship} className={styles.addButton}>+ 添加实习/工作经历</button>}
      </div>

      {/* 项目经历 */}
      <div className={styles.section}>
        <h3>项目经历</h3>
        {profile.projects.map((proj, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>项目 #{index + 1}</span>
              {!readOnly && (
                <button onClick={() => removeProject(index)} className={styles.removeButton}>删除</button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>项目名称</label>
                <input type="text" value={proj.name}
                  onChange={(e) => updateProject(index, 'name', e.target.value)}
                  placeholder="项目名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>担任角色</label>
                <input type="text" value={proj.role}
                  onChange={(e) => updateProject(index, 'role', e.target.value)}
                  placeholder="如：负责人/核心成员" disabled={readOnly} />
              </div>
              <div className={styles.fieldFull}>
                <label>项目描述</label>
                <textarea value={proj.description}
                  onChange={(e) => updateProject(index, 'description', e.target.value)}
                  placeholder="项目背景、目标、你的贡献和成果..." rows={3} disabled={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button onClick={addProject} className={styles.addButton}>+ 添加项目经历</button>}
      </div>

      {/* 获奖经历 */}
      <div className={styles.section}>
        <h3>获奖经历</h3>
        {(profile.awards || []).map((award, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>奖项名称</label>
                <input type="text" value={award.name}
                  onChange={(e) => updateAward(index, 'name', e.target.value)}
                  placeholder="如：全国大学生数学建模竞赛一等奖" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>级别</label>
                <input type="text" value={award.level || ''}
                  onChange={(e) => updateAward(index, 'level', e.target.value)}
                  placeholder="如：国家级/省级/校级" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>获奖时间</label>
                <input type="text" value={award.date || ''}
                  onChange={(e) => updateAward(index, 'date', e.target.value)}
                  placeholder="如：2025-06" disabled={readOnly} />
              </div>
              {!readOnly && (
                <div className={styles.field} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => removeAward(index)} className={styles.removeButton}>删除</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!readOnly && <button onClick={addAward} className={styles.addButton}>+ 添加获奖经历</button>}
      </div>

      {/* 证书与语言 */}
      <div className={styles.section}>
        <h3>证书与语言</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>证书资质</label>
            <input type="text" value={profile.certifications?.join(', ') || ''}
              onChange={(e) => setProfile(prev => ({
                ...prev,
                certifications: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              }))}
              placeholder="多个证书用逗号分隔，如：CFA Level 1, CPA" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>语言能力</label>
            <input type="text" value={profile.languages?.join(', ') || ''}
              onChange={(e) => setProfile(prev => ({
                ...prev,
                languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              }))}
              placeholder="如：英语CET-6, 日语N2" disabled={readOnly} />
          </div>
        </div>
      </div>

      {/* 社交与作品 */}
      <div className={styles.section}>
        <h3>社交与作品</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>GitHub</label>
            <input type="text" value={profile.github || ''}
              onChange={(e) => updateField('github', e.target.value)}
              placeholder="GitHub 主页链接" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>个人作品集</label>
            <input type="text" value={profile.portfolio || ''}
              onChange={(e) => updateField('portfolio', e.target.value)}
              placeholder="个人网站/作品集链接" disabled={readOnly} />
          </div>
        </div>
        {(profile.socialLinks || []).map((link, index) => (
          <div key={index} className={styles.inlineFields}>
            <input type="text" value={link.platform}
              onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
              placeholder="平台名（如：LinkedIn）" disabled={readOnly} />
            <input type="text" value={link.url}
              onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
              placeholder="链接地址" disabled={readOnly} />
            {!readOnly && (
              <button onClick={() => removeSocialLink(index)} className={styles.removeButton}>删除</button>
            )}
          </div>
        ))}
        {!readOnly && <button onClick={addSocialLink} className={styles.addButton}>+ 添加社交链接</button>}
      </div>

      {/* 志愿者经历 */}
      <div className={styles.section}>
        <h3>志愿者经历</h3>
        <textarea value={profile.volunteerExperience || ''}
          onChange={(e) => updateField('volunteerExperience', e.target.value)}
          placeholder="描述志愿者活动、社区服务等经历..." rows={3} disabled={readOnly}
          className={styles.fullTextarea} />
      </div>

      {/* 求职意向 */}
      <div className={styles.section}>
        <h3>求职意向</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>目标职位</label>
            <input type="text" value={profile.targetPosition || ''}
              onChange={(e) => updateField('targetPosition', e.target.value)}
              placeholder="如：数据分析师、前端开发" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>目标工作地点</label>
            <input type="text" value={profile.targetLocation || ''}
              onChange={(e) => updateField('targetLocation', e.target.value)}
              placeholder="如：北京、上海、深圳" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>期望薪资范围</label>
            <input type="text" value={profile.targetSalary || ''}
              onChange={(e) => updateField('targetSalary', e.target.value)}
              placeholder="如：8-12K, 15-25K" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>目标行业</label>
            <input type="text" value={profile.targetIndustry || ''}
              onChange={(e) => updateField('targetIndustry', e.target.value)}
              placeholder="如：金融、互联网、咨询" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>工作类型偏好</label>
            <select value={profile.jobTypePreference || ''}
              onChange={(e) => updateField('jobTypePreference', e.target.value)} disabled={readOnly}>
              <option value="">请选择</option>
              <option value="全职">全职</option>
              <option value="实习">实习</option>
              <option value="兼职">兼职</option>
              <option value="远程">远程</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>可入职时间</label>
            <select value={profile.availability || ''}
              onChange={(e) => updateField('availability', e.target.value)} disabled={readOnly}>
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
            <textarea value={profile.selfEvaluation || ''}
              onChange={(e) => updateField('selfEvaluation', e.target.value)}
              placeholder="简要描述个人优势、特点、职业规划等..." rows={4} disabled={readOnly} />
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className={styles.footer}>
          <button onClick={handleSave} disabled={isSaving} className={styles.primaryButton}>
            {isSaving ? '保存中...' : '保存所有修改'}
          </button>
        </div>
      )}
    </div>
  );
}