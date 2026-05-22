#!/usr/bin/env python3
import sys
import os

def diagnose_pdf(filepath):
    try:
        import pypdfium2 as pdfium
        
        print(f"=== PDF 诊断: {filepath} ===")
        print(f"pypdfium2 版本: {pdfium.__version__ if hasattr(pdfium, '__version__') else 'unknown'}")
        
        pdf = pdfium.PdfDocument(filepath)
        print(f"页数: {len(pdf)}")
        
        for page_idx in range(min(len(pdf), 3)):  # 只检查前3页
            page = pdf[page_idx]
            print(f"\n--- 第 {page_idx + 1} 页 ---")
            print(f"页面尺寸: {page.get_width()} x {page.get_height()}")
            
            try:
                textpage = page.get_textpage()
                print("TextPage 创建成功")
                
                # 尝试不同方法
                methods_to_try = [
                    ('get_text_range', lambda: textpage.get_text_range()),
                    ('get_text_bounded', lambda: textpage.get_text_bounded()),
                ]
                
                for method_name, method_func in methods_to_try:
                    try:
                        result = method_func()
                        if result:
                            print(f"{method_name}: 成功, 长度={len(result)}, 前100字符: {result[:100]}...")
                        else:
                            print(f"{method_name}: 返回空/None")
                    except Exception as e:
                        print(f"{method_name}: 错误 - {e}")
                        
            except Exception as e:
                print(f"TextPage 创建失败: {e}")
        
        pdf.close()
        
    except ImportError:
        print("错误: pypdfium2 未安装")
        print("请运行: pip install pypdfium2")
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python diagnose_pdf.py <pdf_file>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"文件不存在: {filepath}")
        sys.exit(1)
    
    diagnose_pdf(filepath)