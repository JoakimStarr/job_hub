'use client';

import { useState, useEffect } from 'react';
import { Input, Textarea } from '@/components/ui';
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

  useEffect(() => {
    if (initialProfile) {
      setProfile({ ...EMPTY_PROFILE, ...initialProfile });
    }
  }, [initialProfile]);

  const addEducation = () => {
    const newEdu: Education = {
      school: '', major: '', degree: '本科',
      graduationYear: new Date().getFullYear(),
      startDate: '', endDate: '',
    };
    setProfile(prev => ({ ...prev, education: [...prev.education, newEdu] }));
  };

  const removeEducation = (index: number) => {
    setProfile(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

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

  const addInternship = () => {
    const newIntern: Internship = {
      company: '', position: '', duration: '',
      description: '', startDate: '', endDate: '',
    };
    setProfile(prev => ({ ...prev, internships: [...prev.internships, newIntern] }));
  };

  const removeInternship = (index: number) => {
    setProfile(prev => ({
      ...prev,
      internships: prev.internships.filter((_, i) => i !== index),
    }));
  };

  const addProject = () => {
    const newProj: Project = { name: '', role: '', description: '' };
    setProfile(prev => ({ ...prev, projects: [...prev.projects, newProj] }));
  };

  const removeProject = (index: number) => {
    setProfile(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
  };

  const addAward = () => {
    const newAward: Award = { name: '', level: '', date: '' };
    setProfile(prev => ({ ...prev, awards: [...(prev.awards || []), newAward] }));
  };

  const removeAward = (index: number) => {
    setProfile(prev => ({
      ...prev,
      awards: (prev.awards || []).filter((_, i) => i !== index),
    }));
  };

  const addSocialLink = () => {
    const newLink: SocialLink = { platform: '', url: '' };
    setProfile(prev => ({ ...prev, socialLinks: [...(prev.socialLinks || []), newLink] }));
  };

  const removeSocialLink = (index: number) => {
    setProfile(prev => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const fd = new FormData(e.currentTarget);

    const updatedProfile: ResumeProfile = {
      ...profile,
      name: (fd.get('name') as string) || '',
      gender: (fd.get('gender') as string) || '',
      birthDate: (fd.get('birthDate') as string) || '',
      age: fd.get('age') ? parseInt(fd.get('age') as string) : undefined,
      phone: (fd.get('phone') as string) || '',
      email: (fd.get('email') as string) || '',
      address: (fd.get('address') as string) || '',
      certifications: ((fd.get('certifications') as string) || '').split(',').map(s => s.trim()).filter(Boolean),
      languages: ((fd.get('languages') as string) || '').split(',').map(s => s.trim()).filter(Boolean),
      github: (fd.get('github') as string) || '',
      portfolio: (fd.get('portfolio') as string) || '',
      targetPosition: (fd.get('targetPosition') as string) || '',
      targetLocation: (fd.get('targetLocation') as string) || '',
      targetSalary: (fd.get('targetSalary') as string) || '',
      targetIndustry: (fd.get('targetIndustry') as string) || '',
      jobTypePreference: (fd.get('jobTypePreference') as string) || '',
      availability: (fd.get('availability') as string) || '',
      selfEvaluation: (fd.get('selfEvaluation') as string) || '',
      volunteerExperience: (fd.get('volunteerExperience') as string) || '',
      education: profile.education.map((edu, i) => ({
        ...edu,
        school: (fd.get(`edu_school_${i}`) as string) || '',
        major: (fd.get(`edu_major_${i}`) as string) || '',
        degree: (fd.get(`edu_degree_${i}`) as string) || '',
        graduationYear: fd.get(`edu_year_${i}`) ? parseInt(fd.get(`edu_year_${i}`) as string) : edu.graduationYear,
      })),
      internships: profile.internships.map((intern, i) => ({
        ...intern,
        company: (fd.get(`intern_company_${i}`) as string) || '',
        position: (fd.get(`intern_position_${i}`) as string) || '',
        duration: (fd.get(`intern_duration_${i}`) as string) || '',
        description: (fd.get(`intern_desc_${i}`) as string) || '',
      })),
      projects: profile.projects.map((proj, i) => ({
        ...proj,
        name: (fd.get(`proj_name_${i}`) as string) || '',
        role: (fd.get(`proj_role_${i}`) as string) || '',
        description: (fd.get(`proj_desc_${i}`) as string) || '',
      })),
      awards: (profile.awards || []).map((award, i) => ({
        ...award,
        name: (fd.get(`award_name_${i}`) as string) || '',
        level: (fd.get(`award_level_${i}`) as string) || '',
        date: (fd.get(`award_date_${i}`) as string) || '',
      })),
      socialLinks: (profile.socialLinks || []).map((link, i) => ({
        ...link,
        platform: (fd.get(`link_platform_${i}`) as string) || '',
        url: (fd.get(`link_url_${i}`) as string) || '',
      })),
    };

    try {
      const response = await API.request<{ success: boolean; profile: ResumeProfile }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updatedProfile),
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
      <form onSubmit={handleSave}>
      <div className={styles.header}>
        <h2>用户画像</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => setShowSensitive(!showSensitive)}
            className={styles.toggleBtn}
            title={showSensitive ? '隐藏敏感信息' : '显示敏感信息'}
          >
            {showSensitive ? '🔒 隐藏' : '👁 显示'}隐私
          </button>
          {!readOnly && (
            <button type="submit" disabled={isSaving} className={styles.saveButton}>
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
            <Input type="text" name="name" defaultValue={profile.name || ''}
              placeholder="请输入姓名" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>性别</label>
            <select name="gender" defaultValue={profile.gender || ''} disabled={readOnly}>
              <option value="">请选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>出生日期</label>
            <input type="date" name="birthDate" defaultValue={profile.birthDate || ''} disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>年龄</label>
            <input type="number" name="age" defaultValue={profile.age || ''}
              placeholder="年龄" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>手机号 {showSensitive && <span className={styles.sensitiveTag}>明文</span>}</label>
            <input type="tel" name="phone" defaultValue={displayPhone}
              placeholder="手机号码" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>邮箱 {showSensitive && <span className={styles.sensitiveTag}>明文</span>}</label>
            <input type="email" name="email" defaultValue={displayEmail}
              placeholder="email@example.com" disabled={readOnly} />
          </div>
          <div className={styles.fieldFull}>
            <label>现居地址</label>
            <Input type="text" name="address" defaultValue={profile.address || ''}
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
                <button type="button" onClick={() => removeEducation(index)} className={styles.removeButton}>删除</button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>学校</label>
                <Input type="text" name={`edu_school_${index}`} defaultValue={edu.school}
                  placeholder="学校名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>专业</label>
                <Input type="text" name={`edu_major_${index}`} defaultValue={edu.major}
                  placeholder="专业名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>学位</label>
                <select name={`edu_degree_${index}`} defaultValue={edu.degree} disabled={readOnly}>
                  <option value="博士">博士</option>
                  <option value="硕士">硕士</option>
                  <option value="本科">本科</option>
                  <option value="专科">专科</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>毕业年份</label>
                <input type="number" name={`edu_year_${index}`} defaultValue={edu.graduationYear || ''}
                  placeholder="2026" disabled={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button type="button" onClick={addEducation} className={styles.addButton}>+ 添加教育经历</button>}
      </div>

      {/* 技能标签 */}
      <div className={styles.section}>
        <h3>技能标签</h3>
        <div className={styles.tagsContainer}>
          {profile.skills.map((skill, index) => (
            <span key={index} className={styles.tag}>
              {skill}
              {!readOnly && (
                <button type="button" onClick={() => removeSkill(index)} className={styles.tagRemove}>x</button>
              )}
            </span>
          ))}
          {!readOnly && (
            <div className={styles.tagInput}>
              <Input id="new-skill-input" type="text" placeholder="输入技能后回车添加"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
              <button type="button" onClick={addSkill} className={styles.addTagButton}>添加</button>
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
                <button type="button" onClick={() => removeInternship(index)} className={styles.removeButton}>删除</button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>公司名称</label>
                <Input type="text" name={`intern_company_${index}`} defaultValue={intern.company}
                  placeholder="公司名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>职位</label>
                <Input type="text" name={`intern_position_${index}`} defaultValue={intern.position}
                  placeholder="职位名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>时长</label>
                <Input type="text" name={`intern_duration_${index}`} defaultValue={intern.duration}
                  placeholder="如：3个月" disabled={readOnly} />
              </div>
              <div className={styles.fieldFull}>
                <label>工作描述</label>
                <Textarea name={`intern_desc_${index}`} defaultValue={intern.description}
                  placeholder="详细描述工作内容和成果..." rows={3} disabled={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button type="button" onClick={addInternship} className={styles.addButton}>+ 添加实习/工作经历</button>}
      </div>

      {/* 项目经历 */}
      <div className={styles.section}>
        <h3>项目经历</h3>
        {profile.projects.map((proj, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>项目 #{index + 1}</span>
              {!readOnly && (
                <button type="button" onClick={() => removeProject(index)} className={styles.removeButton}>删除</button>
              )}
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>项目名称</label>
                <Input type="text" name={`proj_name_${index}`} defaultValue={proj.name}
                  placeholder="项目名称" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>担任角色</label>
                <Input type="text" name={`proj_role_${index}`} defaultValue={proj.role}
                  placeholder="如：负责人/核心成员" disabled={readOnly} />
              </div>
              <div className={styles.fieldFull}>
                <label>项目描述</label>
                <Textarea name={`proj_desc_${index}`} defaultValue={proj.description}
                  placeholder="项目背景、目标、你的贡献和成果..." rows={3} disabled={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button type="button" onClick={addProject} className={styles.addButton}>+ 添加项目经历</button>}
      </div>

      {/* 获奖经历 */}
      <div className={styles.section}>
        <h3>获奖经历</h3>
        {(profile.awards || []).map((award, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>奖项名称</label>
                <Input type="text" name={`award_name_${index}`} defaultValue={award.name}
                  placeholder="如：全国大学生数学建模竞赛一等奖" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>级别</label>
                <Input type="text" name={`award_level_${index}`} defaultValue={award.level || ''}
                  placeholder="如：国家级/省级/校级" disabled={readOnly} />
              </div>
              <div className={styles.field}>
                <label>获奖时间</label>
                <Input type="text" name={`award_date_${index}`} defaultValue={award.date || ''}
                  placeholder="如：2025-06" disabled={readOnly} />
              </div>
              {!readOnly && (
                <div className={styles.field} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" onClick={() => removeAward(index)} className={styles.removeButton}>删除</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!readOnly && <button type="button" onClick={addAward} className={styles.addButton}>+ 添加获奖经历</button>}
      </div>

      {/* 证书与语言 */}
      <div className={styles.section}>
        <h3>证书与语言</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>证书资质</label>
            <Input type="text" name="certifications" defaultValue={profile.certifications?.join(', ') || ''}
              placeholder="多个证书用逗号分隔，如：CFA Level 1, CPA" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>语言能力</label>
            <Input type="text" name="languages" defaultValue={profile.languages?.join(', ') || ''}
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
            <Input type="text" name="github" defaultValue={profile.github || ''}
              placeholder="GitHub 主页链接" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>个人作品集</label>
            <Input type="text" name="portfolio" defaultValue={profile.portfolio || ''}
              placeholder="个人网站/作品集链接" disabled={readOnly} />
          </div>
        </div>
        {(profile.socialLinks || []).map((link, index) => (
          <div key={index} className={styles.inlineFields}>
            <Input type="text" name={`link_platform_${index}`} defaultValue={link.platform}
              placeholder="平台名（如：LinkedIn）" disabled={readOnly} />
            <Input type="text" name={`link_url_${index}`} defaultValue={link.url}
              placeholder="链接地址" disabled={readOnly} />
            {!readOnly && (
              <button type="button" onClick={() => removeSocialLink(index)} className={styles.removeButton}>删除</button>
            )}
          </div>
        ))}
        {!readOnly && <button type="button" onClick={addSocialLink} className={styles.addButton}>+ 添加社交链接</button>}
      </div>

      {/* 志愿者经历 */}
      <div className={styles.section}>
        <h3>志愿者经历</h3>
        <Textarea name="volunteerExperience" defaultValue={profile.volunteerExperience || ''}
          placeholder="描述志愿者活动、社区服务等经历..." rows={3} disabled={readOnly}
          className={styles.fullTextarea} />
      </div>

      {/* 求职意向 */}
      <div className={styles.section}>
        <h3>求职意向</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>目标职位</label>
            <Input type="text" name="targetPosition" defaultValue={profile.targetPosition || ''}
              placeholder="如：数据分析师、前端开发" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>目标工作地点</label>
            <Input type="text" name="targetLocation" defaultValue={profile.targetLocation || ''}
              placeholder="如：北京、上海、深圳" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>期望薪资范围</label>
            <Input type="text" name="targetSalary" defaultValue={profile.targetSalary || ''}
              placeholder="如：8-12K, 15-25K" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>目标行业</label>
            <Input type="text" name="targetIndustry" defaultValue={profile.targetIndustry || ''}
              placeholder="如：金融、互联网、咨询" disabled={readOnly} />
          </div>
          <div className={styles.field}>
            <label>工作类型偏好</label>
            <select name="jobTypePreference" defaultValue={profile.jobTypePreference || ''} disabled={readOnly}>
              <option value="">请选择</option>
              <option value="全职">全职</option>
              <option value="实习">实习</option>
              <option value="兼职">兼职</option>
              <option value="远程">远程</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>可入职时间</label>
            <select name="availability" defaultValue={profile.availability || ''} disabled={readOnly}>
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
            <Textarea name="selfEvaluation" defaultValue={profile.selfEvaluation || ''}
              placeholder="简要描述个人优势、特点、职业规划等..." rows={4} disabled={readOnly} />
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className={styles.footer}>
          <button type="submit" disabled={isSaving} className={styles.primaryButton}>
            {isSaving ? '保存中...' : '保存所有修改'}
          </button>
        </div>
      )}
      </form>
    </div>
  );
}
