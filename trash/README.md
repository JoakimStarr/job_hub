# Trash Directory - 归档文件说明

本目录存放已废弃的文件，不再被项目使用。

## 归档时间: 2026-05-19

## 归档原因
这3个数据清洗脚本已被 `scripts/clean_data.js` 完全替代，功能更全面且维护更好。

## 归档文件列表
- scripts_clean_locations.js (原v1版本，最简实现)
- scripts_clean_locations.ts (JS版的TypeScript移植，功能等价)
- scripts_clean_locations_v2.js (增强版，功能被子集覆盖)

## 当前推荐使用
- `scripts/clean_data.js` - 唯一的数据清洗入口，同时处理地点+学历数据

## 恢复方法
如需恢复，将文件移回 `scripts/` 目录即可。
