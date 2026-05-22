import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUnified } from '@/lib/auth-server';
import { AuthError } from '@/lib/auth';
import {
  initUserProfileTables,
  getActiveProfile,
  createProfile,
  updateProfile,
  saveParsedProfile,
  getProfileHistory,
  rollbackProfile,
  deleteProfile,
  type ProfileUpdatePayload,
} from '@/lib/user-profile-db';
import type { ResumeProfile } from '@/types';
import { logger } from '@/lib/logger';

initUserProfileTables();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const userId = user.id || 1;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const history = getProfileHistory(userId, limit);
      
      return NextResponse.json({
        success: true,
        history: history.map(h => ({
          id: h.id,
          version: h.version,
          source: h.source,
          fileName: h.file_name,
          confidenceScore: h.confidence_score,
          updatedAt: h.updated_at,
          isActive: h.is_active,
        })),
      });
    }

    const profile = getActiveProfile(userId);

    return NextResponse.json({
      success: true,
      profile: profile || null,
      hasProfile: !!profile,
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('获取用户画像失败:', error);
    return NextResponse.json(
      { error: '获取画像失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const userId = user.id || 1;

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const profileData = data.profile as ResumeProfile;
        
        if (!profileData) {
          return NextResponse.json(
            { error: '缺少画像数据' },
            { status: 400 }
          );
        }

        const profileId = createProfile(userId, profileData, {
          source: data.source || 'manual',
          confidenceScore: data.confidenceScore || 0,
        });

        logger.info('创建用户画像', { userId, profileId });
        
        return NextResponse.json({
          success: true,
          profileId,
          message: '画像创建成功',
        });
      }

      case 'save_parsed': {
        const profileData = data.profile as ResumeProfile;
        const fileHash = data.fileHash as string;
        const fileName = data.fileName as string;
        const confidenceScore = data.confidenceScore as number;

        if (!profileData || !fileHash) {
          return NextResponse.json(
            { error: '缺少必要参数' },
            { status: 400 }
          );
        }

        const profileId = saveParsedProfile(
          userId,
          profileData,
          fileHash,
          fileName,
          confidenceScore
        );

        logger.info('保存解析后的画像', { userId, profileId, fileName });
        
        return NextResponse.json({
          success: true,
          profileId,
          message: '解析结果已保存',
        });
      }

      default:
        return NextResponse.json(
          { error: '未知操作类型' },
          { status: 400 }
        );
    }

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('创建用户画像失败:', error);
    return NextResponse.json(
      { error: '创建画像失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const userId = user.id || 1;

    const body = await request.json();
    const updates = body as ProfileUpdatePayload;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '没有要更新的字段' },
        { status: 400 }
      );
    }

    const updatedProfile = updateProfile(userId, updates);

    if (!updatedProfile) {
      return NextResponse.json(
        { error: '未找到现有画像，请先上传简历或手动创建' },
        { status: 404 }
      );
    }

    logger.info('更新用户画像', { 
      userId, 
      updatedFields: Object.keys(updates) 
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: '画像更新成功',
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('更新用户画像失败:', error);
    return NextResponse.json(
      { error: '更新画像失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthUnified(request);
    const userId = user.id || 1;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'rollback') {
      const targetVersion = parseInt(searchParams.get('version') || '0');
      
      if (!targetVersion) {
        return NextResponse.json(
          { error: '缺少目标版本号' },
          { status: 400 }
        );
      }

      const success = rollbackProfile(userId, targetVersion);

      if (!success) {
        return NextResponse.json(
          { error: '回滚失败，目标版本不存在' },
          { status: 404 }
        );
      }

      logger.info('回滚用户画像', { userId, targetVersion });
      
      return NextResponse.json({
        success: true,
        message: `已回滚到版本 ${targetVersion}`,
      });
    }

    const success = deleteProfile(userId);

    if (!success) {
      return NextResponse.json(
        { error: '删除失败，未找到画像数据' },
        { status: 404 }
      );
    }

    logger.info('删除用户画像', { userId });
    
    return NextResponse.json({
      success: true,
      message: '画像已删除',
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('删除用户画像失败:', error);
    return NextResponse.json(
      { error: '删除画像失败' },
      { status: 500 }
    );
  }
}