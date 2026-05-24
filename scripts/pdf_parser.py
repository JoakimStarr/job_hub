#!/usr/bin/env python3
import sys
import os
import json
import re
import subprocess
import shutil

def check_dependencies():
    """检查所有依赖是否已安装，返回详细的诊断信息"""
    diagnostics = {
        'python_executable': sys.executable,
        'python_version': sys.version.split()[0],
        'dependencies': {},
        'system_tools': {},
        'missing': []
    }

    # 检查 Python 依赖
    python_deps = {
        'pypdfium2': 'pip3 install pypdfium2',
        'pdf2image': 'pip3 install pdf2image',
        'pytesseract': 'pip3 install pytesseract',
    }

    for module, install_cmd in python_deps.items():
        try:
            if module == 'pypdfium2':
                import pypdfium2
                diagnostics['dependencies'][module] = {'status': 'OK', 'version': 'installed'}
            elif module == 'pdf2image':
                from pdf2image import convert_from_path
                diagnostics['dependencies'][module] = {'status': 'OK', 'version': 'installed'}
            elif module == 'pytesseract':
                import pytesseract
                diagnostics['dependencies'][module] = {'status': 'OK', 'version': 'installed'}
        except ImportError as e:
            diagnostics['dependencies'][module] = {
                'status': 'MISSING',
                'error': str(e),
                'install_cmd': install_cmd
            }
            diagnostics['missing'].append(f"Python模块: {module}")

    # 检查系统工具
    system_tools = {
        'tesseract': ('tesseract-ocr tesseract-ocr-chi-sim', 'sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim'),
        'pdftoppm': ('poppler-utils', 'sudo apt-get install poppler-utils'),
    }

    for tool, (pkg, install_cmd) in system_tools.items():
        tool_path = shutil.which(tool)
        if tool_path:
            # 尝试获取版本信息
            try:
                result = subprocess.run([tool, '--version' if tool == 'tesseract' else '-v'],
                                       capture_output=True, text=True, timeout=5)
                version = result.stdout.split('\n')[0] if result.stdout else 'unknown'
                diagnostics['system_tools'][tool] = {
                    'status': 'OK',
                    'path': tool_path,
                    'version': version
                }
            except Exception as e:
                diagnostics['system_tools'][tool] = {
                    'status': 'OK',
                    'path': tool_path,
                    'error': str(e)
                }
        else:
            diagnostics['system_tools'][tool] = {
                'status': 'MISSING',
                'package': pkg,
                'install_cmd': install_cmd
            }
            diagnostics['missing'].append(f"系统工具: {tool} (来自 {pkg})")

    return diagnostics

def extract_with_ocr(filepath):
    """使用OCR提取扫描版PDF的文字"""
    try:
        from pdf2image import convert_from_path
        import pytesseract

        print("检测到扫描版PDF，使用OCR提取文字...", file=sys.stderr)

        images = convert_from_path(filepath, dpi=200)
        text_parts = []
        total_chars = 0

        for i, image in enumerate(images):
            print(f"正在OCR识别第 {i+1}/{len(images)} 页...", file=sys.stderr)

            # 使用中文+英文语言包
            text = pytesseract.image_to_string(image, lang='chi_sim+eng')
            if text and text.strip():
                cleaned = text.strip()
                text_parts.append(cleaned)
                total_chars += len(cleaned)

        return '\n\n'.join(text_parts), len(text_parts), total_chars

    except ImportError as e:
        raise ImportError(f"缺少OCR依赖: {e}")
    except Exception as e:
        raise Exception(f"OCR提取失败: {e}")

def extract_pdf_text(filepath):
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(filepath)
    text_parts = []
    total_chars = 0
    has_text_layer = False

    for page_idx in range(len(pdf)):
        page = pdf[page_idx]

        try:
            textpage = page.get_textpage()
            text = textpage.get_text_range()

            if text and text.strip():
                has_text_layer = True
                cleaned_page = text.strip()
                text_parts.append(cleaned_page)
                total_chars += len(cleaned_page)
        except Exception as e:
            print(f"Warning: Error on page {page_idx}: {e}", file=sys.stderr)
            continue

    pdf.close()

    # 如果没有提取到文字，可能是扫描版，尝试OCR
    if not has_text_layer or total_chars < 50:
        print("未检测到文本层或文本过少，尝试OCR...", file=sys.stderr)
        ocr_text, ocr_pages, ocr_chars = extract_with_ocr(filepath)
        if ocr_text and ocr_chars > 50:
            return ocr_text, ocr_pages, ocr_chars, True

    full_text = '\n\n'.join(text_parts).strip()

    # 清理文本
    cleaned = re.sub(r'[^\u0020-\u007E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]', ' ', full_text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    return cleaned, len(text_parts), total_chars, False

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python pdf_parser.py <pdf_file_path>'
        }))
        sys.exit(0)

    filepath = sys.argv[1]

    if not os.path.exists(filepath):
        print(json.dumps({
            'success': False,
            'error': f'File not found: {filepath}'
        }))
        sys.exit(0)

    # 首先进行依赖检查（仅在出错时输出详细信息）
    diag = check_dependencies()
    has_missing = len(diag['missing']) > 0

    try:
        text, pages, raw_length, used_ocr = extract_pdf_text(filepath)

        result = {
            'text': text,
            'raw_length': raw_length,
            'cleaned_length': len(text),
            'pages': pages,
            'success': True,
            'used_ocr': used_ocr,
        }
        print(json.dumps(result, ensure_ascii=False))

    except ImportError as e:
        # ImportError: 输出详细的依赖诊断信息
        error_msg = f"PDF 解析依赖导入失败: {e}\n\n"
        error_msg += "=== 依赖诊断信息 ===\n"
        error_msg += f"Python: {diag['python_executable']} (v{diag['python_version']})\n\n"

        error_msg += "Python 模块:\n"
        for dep, info in diag['dependencies'].items():
            status = info.get('status', 'UNKNOWN')
            if status == 'OK':
                error_msg += f"  ✅ {dep}: 已安装\n"
            else:
                error_msg += f"  ❌ {dep}: 未安装 - {info.get('install_cmd', '')}\n"

        error_msg += "\n系统工具:\n"
        for tool, info in diag['system_tools'].items():
            status = info.get('status', 'UNKNOWN')
            if status == 'OK':
                error_msg += f"  ✅ {tool}: {info.get('path', 'unknown')} ({info.get('version', 'unknown')})\n"
            else:
                error_msg += f"  ❌ {tool}: 未找到 - {info.get('install_cmd', '')}\n"

        if has_missing:
            error_msg += "\n=== 安装命令 ===\n"
            missing_python = [d for d in diag['missing'] if d.startswith('Python')]
            missing_system = [d for d in diag['missing'] if d.startswith('系统')]

            if missing_system:
                error_msg += "# 安装系统依赖（需要 sudo 权限）\n"
                for tool, info in diag['system_tools'].items():
                    if info.get('status') == 'MISSING':
                        error_msg += f"{info.get('install_cmd', '')}\n"

            if missing_python:
                error_msg += "\n# 安装 Python 依赖\n"
                install_cmds = set()
                for dep, info in diag['dependencies'].items():
                    if info.get('status') == 'MISSING' and info.get('install_cmd'):
                        install_cmds.add(info['install_cmd'])
                for cmd in sorted(install_cmds):
                    error_msg += f"{cmd}\n"

        print(json.dumps({
            'success': False,
            'error': error_msg,
            'need_install': True,
            'diagnostics': diag
        }, ensure_ascii=False))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'diagnostics': diag if has_missing else None
        }, ensure_ascii=False))
        sys.exit(0)

if __name__ == '__main__':
    main()
