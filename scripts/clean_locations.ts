import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

const PROVINCE_MAP: Record<string, string> = {
  '北京': '北京', '天津': '天津', '上海': '上海', '重庆': '重庆',
  '河北': '河北', '山西': '山西', '辽宁': '辽宁', '吉林': '吉林',
  '黑龙江': '黑龙江', '江苏': '江苏', '浙江': '浙江', '安徽': '安徽',
  '福建': '福建', '江西': '江西', '山东': '山东', '河南': '河南',
  '湖北': '湖北', '湖南': '湖南', '广东': '广东', '海南': '海南',
  '四川': '四川', '贵州': '贵州', '云南': '云南', '陕西': '陕西',
  '甘肃': '甘肃', '青海': '青海', '台湾': '台湾',
  '内蒙古': '内蒙古', '广西': '广西', '西藏': '西藏',
  '宁夏': '宁夏', '新疆': '新疆',
  '香港': '香港', '澳门': '澳门',
};

const CITY_STANDARD_MAP: Record<string, string> = {
  '北京市': '北京', '上海市': '上海', '天津市': '天津', '重庆市': '重庆',
  '广州市': '广州', '深圳市': '深圳', '杭州市': '杭州', '南京市': '南京',
  '武汉市': '武汉', '成都市': '成都', '西安市': '西安', '苏州市': '苏州',
  '青岛市': '青岛', '大连市': '大连', '宁波市': '宁波', '厦门市': '厦门',
  '济南市': '济南', '郑州市': '郑州', '长沙市': '长沙', '合肥市': '合肥',
  '福州市': '福州', '南昌市': '南昌', '昆明市': '昆明', '贵阳市': '贵阳',
  '南宁市': '南宁', '海口市': '海口', '沈阳市': '沈阳', '长春市': '长春',
  '哈尔滨市': '哈尔滨', '石家庄市': '石家庄', '太原市': '太原',
  '呼和浩特市': '呼和浩特', '兰州市': '兰州', '西宁市': '西宁',
  '银川市': '银川', '乌鲁木齐市': '乌鲁木齐', '拉萨市': '拉萨',
  '江苏省南京市': '南京', '浙江省杭州市': '杭州', '广东省广州市': '广州',
  '广东省深圳市': '深圳', '四川省成都市': '成都', '湖北省武汉市': '武汉',
  '陕西省西安市': '西安', '山东省济南市': '济南', '山东省青岛市': '青岛',
  '河南省郑州市': '郑州', '湖南省长沙市': '长沙', '安徽省合肥市': '合肥',
  '福建省福州市': '福州', '福建省厦门市': '厦门', '江西省南昌市': '南昌',
  '云南省昆明市': '昆明', '贵州省贵阳市': '贵阳', '广西南宁市': '南宁',
  '海南省海口市': '海口', '辽宁省沈阳市': '沈阳', '辽宁省大连市': '大连',
  '吉林省长春市': '长春', '黑龙江省哈尔滨市': '哈尔滨',
  '河北省石家庄市': '石家庄', '山西省太原市': '太原',
  '内蒙古呼和浩特市': '呼和浩特', '甘肃省兰州市': '兰州',
  '青海省西宁市': '西宁', '宁夏银川市': '银川',
  '新疆乌鲁木齐市': '乌鲁木齐', '西藏拉萨市': '拉萨',
};

function normalizeLocation(location: string): string {
  if (!location || location.trim() === '') return '';
  
  let normalized = location.trim();
  
  if (CITY_STANDARD_MAP[normalized]) {
    return CITY_STANDARD_MAP[normalized];
  }
  
  normalized = normalized
    .replace(/省直辖县级行政区划/g, '')
    .replace(/市辖区/g, '')
    .replace(/自治区/g, '')
    .replace(/特别行政区/g, '')
    .replace(/省$/g, '')
    .replace(/市$/g, '')
    .trim();
  
  if (CITY_STANDARD_MAP[normalized + '市']) {
    return CITY_STANDARD_MAP[normalized + '市'];
  }
  
  if (normalized.length >= 2 && normalized.length <= 4) {
    return normalized;
  }
  
  return location;
}

function cleanLocation(location: string): string {
  if (!location || location.trim() === '') return '';
  
  const separators = [',', '，', '、', '/', '|'];
  let parts = [location];
  
  for (const sep of separators) {
    parts = parts.flatMap(p => p.split(sep));
  }
  
  const cleanedParts = parts
    .map(p => normalizeLocation(p))
    .filter(p => p && p.length >= 2);
  
  const uniqueParts = [...new Set(cleanedParts)];
  
  return uniqueParts.slice(0, 3).join(',');
}

function main() {
  console.log('开始清洗地点数据...');
  
  const db = new Database(DB_PATH, { readonly: false });
  
  const jobs = db.prepare('SELECT id, location FROM jobs WHERE location IS NOT NULL AND location != ""').all() as { id: number; location: string }[];
  
  console.log(`共有 ${jobs.length} 条记录需要处理`);
  
  const updateStmt = db.prepare('UPDATE jobs SET location = ? WHERE id = ?');
  
  let updated = 0;
  let skipped = 0;
  
  const transaction = db.transaction(() => {
    for (const job of jobs) {
      const cleaned = cleanLocation(job.location);
      
      if (cleaned !== job.location) {
        updateStmt.run(cleaned, job.id);
        updated++;
      } else {
        skipped++;
      }
      
      if ((updated + skipped) % 500 === 0) {
        console.log(`已处理 ${updated + skipped}/${jobs.length} 条，更新 ${updated} 条`);
      }
    }
  });
  
  transaction();
  
  db.close();
  
  console.log(`\n清洗完成！`);
  console.log(`- 更新: ${updated} 条`);
  console.log(`- 跳过: ${skipped} 条`);
}

main();
