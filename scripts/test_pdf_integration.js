#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function testPdfParsing() {
  const pdfPath = 'data/user_profiles/uploads/20260406_182222_吴乾军-商业分析-硕士-数量经济学.pdf';
  const scriptPath = 'scripts/pdf_parser.py';
  
  console.log('🧪 测试 Python PDF 解析器集成...\n');

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF 文件不存在: ${pdfPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Python 脚本不存在: ${scriptPath}`);
    process.exit(1);
  }

  try {
    console.log('📄 读取 PDF 文件...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`✅ PDF 大小: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    console.log('\n🐍 调用 Python 解析器...');
    const startTime = Date.now();
    
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath, pdfPath], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const duration = Date.now() - startTime;
    
    if (stderr) {
      console.log('⚠️  stderr:', stderr);
    }

    console.log(`⏱️  解析耗时: ${duration}ms`);
    
    const result = JSON.parse(stdout);
    
    console.log('\n📊 解析结果:');
    console.log('- 成功:', result.success);
    console.log('- 使用OCR:', result.used_ocr);
    console.log('- 页数:', result.pages);
    console.log('- 原始字符数:', result.raw_length);
    console.log('- 清理后字符数:', result.cleaned_length);
    
    if (result.text) {
      console.log('\n📝 提取的文本 (前200字符):');
      console.log(result.text.substring(0, 200) + '...');
      
      if (result.text.length > 50) {
        console.log('\n✅ 测试通过！PDF解析成功！');
      } else {
        console.log('\n❌ 测试失败！提取的文本过短');
        process.exit(1);
      }
    } else {
      console.log('\n❌ 测试失败！未提取到文本');
      console.log('错误:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error(error.message);
    process.exit(1);
  }
}

testPdfParsing();