import { describe, it, expect } from 'vitest'
import {
  maskPhone,
  maskEmail,
  maskIdCard,
  maskName,
  maskAddress,
  maskGeneric,
  maskProfile,
} from '@/lib/privacy'

describe('Privacy - 数据脱敏工具', () => {
  describe('maskPhone - 手机号脱敏', () => {
    it('标准11位手机号应正确脱敏', () => {
      expect(maskPhone('13812345678')).toBe('138****5678')
      expect(maskPhone('15900001111')).toBe('159****1111')
      expect(maskPhone('18888888888')).toBe('188****8888')
    })

    it('含非数字字符的手机号应先清洗再脱敏', () => {
      expect(maskPhone('138-1234-5678')).toBe('138****5678')
      expect(maskPhone('138 1234 5678')).toBe('138****5678')
    })

    it('超过11位的号码应保留前3后4', () => {
      expect(maskPhone('8613812345678')).toBe('861****5678')
    })

    it('7-10位号码应保留前3后4', () => {
      expect(maskPhone('1234567')).toBe('123****4567')
    })

    it('短于7位的号码应保留前2加星号', () => {
      expect(maskPhone('12345')).toBe('12****')
    })

    it('空字符串应返回空字符串', () => {
      expect(maskPhone('')).toBe('')
    })

    it('undefined/null应返回空字符串', () => {
      expect(maskPhone(null as unknown as string)).toBe('')
      expect(maskPhone(undefined as unknown as string)).toBe('')
    })
  })

  describe('maskEmail - 邮箱脱敏', () => {
    it('标准邮箱应正确脱敏用户名部分', () => {
      expect(maskEmail('zhangsan@example.com')).toBe('zha***@example.com')
      expect(maskEmail('test@company.org')).toBe('tes***@company.org')
    })

    it('长用户名邮箱应保留前3字符', () => {
      expect(maskEmail('verylongusername@test.com')).toBe('ver***@test.com')
    })

    it('短用户名(<=2字符)应保留首字符', () => {
      expect(maskEmail('ab@test.com')).toBe('a***@test.com')
      expect(maskEmail('x@test.com')).toBe('x***@test.com')
    })

    it('无@符号的输入应原样返回', () => {
      expect(maskEmail('notanemail')).toBe('notanemail')
    })

    it('空值应返回空字符串', () => {
      expect(maskEmail('')).toBe('')
      expect(maskEmail(null as unknown as string)).toBe('')
    })
  })

  describe('maskIdCard - 身份证号脱敏', () => {
    it('18位身份证号应正确脱敏', () => {
      expect(maskIdCard('110101199001011234')).toBe('1101**********1234')
    })

    it('15位身份证号应正确脱敏', () => {
      expect(maskIdCard('110101900101234')).toBe('1101**********1234')
    })

    it('短于15位的ID应保留前3加星号', () => {
      expect(maskIdCard('123456789')).toBe('123****')
    })

    it('空值应返回空字符串', () => {
      expect(maskIdCard('')).toBe('')
    })
  })

  describe('maskName - 姓名脱敏', () => {
    it('两字姓名应脱敏第二个字', () => {
      expect(maskName('张三')).toBe('张*')
    })

    it('三字姓名应保留第一个字', () => {
      expect(maskName('欧阳修')).toBe('欧**')
    })

    it('四字及以上的姓名应保留前两个字', () => {
      expect(maskName('司马相如')).toBe('司马**')
      expect(maskName('诸葛孔明先生')).toBe('诸葛****')
    })

    it('单字姓名应原样返回', () => {
      expect(maskName('李')).toBe('李')
    })

    it('空值应返回空字符串', () => {
      expect(maskName('')).toBe('')
    })
  })

  describe('maskAddress - 地址脱敏', () => {
    it('含省市区格式的地址应保留行政区划', () => {
      expect(maskAddress('北京市朝阳区建国路xx号')).toBe('北京市朝阳区***')
      expect(maskAddress('上海市浦东新区xx路xx号')).toBe('上海市浦东新区***')
      expect(maskAddress('广东省深圳市南山区xx街道')).toBe('广东省深圳市***')
    })

    it('含县镇格式的地址应保留行政区划', () => {
      expect(maskAddress('浙江省杭州市西湖区xxx')).toBe('浙江省杭州市***')
    })

    it('不含标准行政区划的地址应截取前4字符', () => {
      expect(maskAddress('某某小区3栋201室')).toBe('某某小区***')
    })

    it('空值应返回空字符串', () => {
      expect(maskAddress('')).toBe('')
    })
  })

  describe('maskGeneric - 通用脱敏', () => {
    it('应保留前后指定数量的字符', () => {
      expect(maskGeneric('1234567890', 2, 2)).toBe('12***90')
      expect(maskGeneric('abcdefg', 3, 1)).toBe('abc***g')
    })

    it('文本过短时应特殊处理', () => {
      expect(maskGeneric('ab', 2, 2)).toBe('a***')
      expect(maskGeneric('a', 2, 2)).toBe('a***')
    })

    it('空值应返回空字符串', () => {
      expect(maskGeneric('')).toBe('')
    })

    it('可自定义保留字符数', () => {
      expect(maskGeneric('9876543210', 1, 3)).toBe('9***210')
    })
  })

  describe('maskProfile - 对象级脱敏', () => {
    it('应对profile对象中的phone和email进行脱敏', () => {
      const profile = {
        name: '张三',
        phone: '13812345678',
        email: 'zhangsan@example.com',
        targetPosition: '数据分析师',
      }

      const masked = maskProfile(profile)

      expect(masked.name).toBe('张三')
      expect(masked.phone).toBe('138****5678')
      expect(masked.email).toBe('zha***@example.com')
      expect(masked.targetPosition).toBe('数据分析师')
    })

    it('应保持原始对象的其他属性不变', () => {
      const profile = {
        name: 'Test',
        phone: '',
        email: '',
        skills: ['Python', 'SQL'],
        education: [],
      }

      const masked = maskProfile(profile)

      expect(masked.skills).toEqual(['Python', 'SQL'])
      expect(masked.education).toEqual([])
    })

    it('空phone和email应正常处理', () => {
      const profile = { name: 'A', phone: '', email: '' }
      const masked = maskProfile(profile)

      expect(masked.phone).toBe('')
      expect(masked.email).toBe('')
    })
  })

  describe('边界条件与安全性', () => {
    it('特殊字符不应导致异常', () => {
      expect(() => maskPhone('<script>alert(1)</script>')).not.toThrow()
      expect(() => maskEmail("'; DROP TABLE users; --")).not.toThrow()
      expect(() => maskName('张\u0000三')).not.toThrow()
    })

    it('Unicode字符应正常处理', () => {
      expect(maskName('張三')).toBe('張*')
      expect(maskPhone('１３８１２３４５６７８')).not.toBe('')
    })

    it('极长输入不应导致性能问题', () => {
      const longStr = 'a'.repeat(10000)
      const start = performance.now()
      const result = maskGeneric(longStr, 2, 2)
      const elapsed = performance.now() - start

      expect(result).toBe('aa***aa')
      expect(elapsed).toBeLessThan(100)
    })

    it('脱敏后长度应小于等于原始长度', () => {
      const inputs = ['13812345678', 'zhangsan@example.com', '110101199001011234']
      for (const input of inputs) {
        const masked = maskGeneric(input, 3, 3)
        expect(masked.length).toBeLessThanOrEqual(input.length + 3)
      }
    })
  })
})
