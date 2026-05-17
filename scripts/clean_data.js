const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'jobs.db');

const PROVINCE_CITY_MAP = {
  '北京': ['北京'],
  '天津': ['天津'],
  '上海': ['上海'],
  '重庆': ['重庆'],
  '河北': ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'],
  '山西': ['太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'],
  '辽宁': ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
  '吉林': ['长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'],
  '黑龙江': ['哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化', '大兴安岭'],
  '江苏': ['南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'],
  '浙江': ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'],
  '安徽': ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'],
  '福建': ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'],
  '江西': ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'],
  '山东': ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'],
  '河南': ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'],
  '湖北': ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施'],
  '湖南': ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'],
  '广东': ['广州', '深圳', '珠海', '汕头', '佛山', '韶关', '湛江', '肇庆', '江门', '茂名', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'],
  '海南': ['海口', '三亚', '三沙', '儋州'],
  '四川': ['成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝', '甘孜', '凉山'],
  '贵州': ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'],
  '云南': ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'],
  '陕西': ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'],
  '甘肃': ['兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南'],
  '青海': ['西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西'],
  '内蒙古': ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
  '广西': ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
  '西藏': ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'],
  '宁夏': ['银川', '石嘴山', '吴忠', '固原', '中卫'],
  '新疆': ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '克孜勒苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰'],
  '香港': ['香港'],
  '澳门': ['澳门'],
  '台湾': ['台北', '高雄', '台中', '台南', '新北', '桃园', '新竹', '嘉义'],
};

const CITY_TO_PROVINCE = {};
for (const [province, cities] of Object.entries(PROVINCE_CITY_MAP)) {
  for (const city of cities) {
    CITY_TO_PROVINCE[city] = province;
  }
}

const ALL_CITIES = Object.values(PROVINCE_CITY_MAP).flat();
const ALL_PROVINCES = Object.keys(PROVINCE_CITY_MAP);

const PINYIN_MAP = {
  '北京': { pinyin: 'beijing', firstLetter: 'bj' },
  '天津': { pinyin: 'tianjin', firstLetter: 'tj' },
  '上海': { pinyin: 'shanghai', firstLetter: 'sh' },
  '重庆': { pinyin: 'chongqing', firstLetter: 'cq' },
  '成都': { pinyin: 'chengdu', firstLetter: 'cd' },
  '深圳': { pinyin: 'shenzhen', firstLetter: 'sz' },
  '广州': { pinyin: 'guangzhou', firstLetter: 'gz' },
  '杭州': { pinyin: 'hangzhou', firstLetter: 'hz' },
  '南京': { pinyin: 'nanjing', firstLetter: 'nj' },
  '武汉': { pinyin: 'wuhan', firstLetter: 'wh' },
  '西安': { pinyin: 'xian', firstLetter: 'xa' },
  '大连': { pinyin: 'dalian', firstLetter: 'dl' },
  '沈阳': { pinyin: 'shenyang', firstLetter: 'sy' },
  '青岛': { pinyin: 'qingdao', firstLetter: 'qd' },
  '济南': { pinyin: 'jinan', firstLetter: 'jn' },
  '郑州': { pinyin: 'zhengzhou', firstLetter: 'zz' },
  '长沙': { pinyin: 'changsha', firstLetter: 'cs' },
  '石家庄': { pinyin: 'shijiazhuang', firstLetter: 'sjz' },
  '合肥': { pinyin: 'hefei', firstLetter: 'hf' },
  '福州': { pinyin: 'fuzhou', firstLetter: 'fz' },
  '厦门': { pinyin: 'xiamen', firstLetter: 'xm' },
  '南昌': { pinyin: 'nanchang', firstLetter: 'nc' },
  '昆明': { pinyin: 'kunming', firstLetter: 'km' },
  '贵阳': { pinyin: 'guiyang', firstLetter: 'gy' },
  '海口': { pinyin: 'haikou', firstLetter: 'hk' },
  '三亚': { pinyin: 'sanya', firstLetter: 'sy' },
  '兰州': { pinyin: 'lanzhou', firstLetter: 'lz' },
  '西宁': { pinyin: 'xining', firstLetter: 'xn' },
  '银川': { pinyin: 'yinchuan', firstLetter: 'yc' },
  '乌鲁木齐': { pinyin: 'wulumuqi', firstLetter: 'wlmq' },
  '呼和浩特': { pinyin: 'huhehaote', firstLetter: 'hhht' },
  '南宁': { pinyin: 'nanning', firstLetter: 'nn' },
  '拉萨': { pinyin: 'lasa', firstLetter: 'ls' },
  '香港': { pinyin: 'xianggang', firstLetter: 'xg' },
  '澳门': { pinyin: 'aomen', firstLetter: 'am' },
  '台北': { pinyin: 'taibei', firstLetter: 'tb' },
};

const EDUCATION_LEVELS = {
  '不限': { level: 0, name: '不限', alias: [] },
  '中专': { level: 1, name: '中专', alias: ['中技', '职高'] },
  '大专': { level: 2, name: '大专', alias: ['专科', '高职'] },
  '本科': { level: 3, name: '本科', alias: ['学士', '大学本科'] },
  '硕士': { level: 4, name: '硕士', alias: ['研究生', '硕士研究生'] },
  '博士': { level: 5, name: '博士', alias: ['博士研究生'] },
  '博士后': { level: 6, name: '博士后', alias: [] },
};

function getPinyin(name) {
  const data = PINYIN_MAP[name];
  if (data) return data;
  return { pinyin: name.toLowerCase(), firstLetter: name.substring(0, 2).toLowerCase() };
}

function normalizeLocation(loc) {
  if (!loc) return '';
  
  let normalized = loc.trim();
  
  normalized = normalized
    .replace(/省$/g, '')
    .replace(/市$/g, '')
    .replace(/县$/g, '')
    .replace(/区$/g, '')
    .trim();
  
  if (normalized.length < 2) return loc;
  
  if (ALL_CITIES.includes(normalized)) return normalized;
  if (ALL_PROVINCES.includes(normalized)) return normalized;
  
  for (const city of ALL_CITIES) {
    if (normalized.includes(city)) return city;
  }
  
  for (const province of ALL_PROVINCES) {
    if (normalized.includes(province)) return province;
  }
  
  return normalized;
}

function splitAndCleanLocations(location) {
  if (!location) return [];
  
  const separators = [',', '，', '、', '/', '|', ' '];
  let parts = [location];
  
  for (const sep of separators) {
    parts = parts.flatMap(p => p.split(sep));
  }
  
  const cleaned = parts
    .map(p => p.trim())
    .filter(p => p.length >= 2)
    .map(normalizeLocation)
    .filter(p => p.length >= 2);
  
  return [...new Set(cleaned)].slice(0, 3);
}

function normalizeEducation(edu) {
  if (!edu) return '';
  
  const trimmed = edu.trim();
  
  for (const [key, value] of Object.entries(EDUCATION_LEVELS)) {
    if (trimmed === key || trimmed === value.name || value.alias.includes(trimmed)) {
      return key;
    }
  }
  
  return trimmed;
}

function splitAndCleanEducation(education) {
  if (!education) return [];
  
  const separators = [',', '，', '、', '/', '|'];
  let parts = [education];
  
  for (const sep of separators) {
    parts = parts.flatMap(p => p.split(sep));
  }
  
  const cleaned = parts
    .map(p => p.trim())
    .filter(p => p.length >= 2)
    .map(normalizeEducation)
    .filter(p => p.length >= 2);
  
  const unique = [...new Set(cleaned)];
  
  unique.sort((a, b) => {
    const levelA = EDUCATION_LEVELS[a]?.level ?? 99;
    const levelB = EDUCATION_LEVELS[b]?.level ?? 99;
    return levelA - levelB;
  });
  
  return unique.slice(0, 3);
}

console.log('开始数据清洗...');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS education_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL,
    alias TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_education_name ON education_mapping(name);
  CREATE INDEX IF NOT EXISTS idx_education_level ON education_mapping(level);
`);

const jobs = db.prepare("SELECT id, location, education FROM jobs").all();
console.log(`共有 ${jobs.length} 条记录需要处理`);

const updateLocationStmt = db.prepare('UPDATE jobs SET location = ? WHERE id = ?');
const updateEducationStmt = db.prepare('UPDATE jobs SET education = ? WHERE id = ?');
const insertLocationMapping = db.prepare(`
  INSERT OR REPLACE INTO location_mapping (name, type, province, pinyin, first_letter)
  VALUES (?, ?, ?, ?, ?)
`);
const insertEducationMapping = db.prepare(`
  INSERT OR REPLACE INTO education_mapping (name, level, alias)
  VALUES (?, ?, ?)
`);

let locationUpdated = 0;
let educationUpdated = 0;
const processedLocations = new Set();
const processedEducations = new Set();

const transaction = db.transaction(() => {
  for (const job of jobs) {
    if (job.location && job.location.includes(',')) {
      const cleaned = splitAndCleanLocations(job.location);
      if (cleaned.length > 0) {
        const newLocation = cleaned.join(',');
        if (newLocation !== job.location) {
          updateLocationStmt.run(newLocation, job.id);
          locationUpdated++;
        }
        
        for (const city of cleaned) {
          if (!processedLocations.has(city)) {
            const province = CITY_TO_PROVINCE[city];
            const type = province ? 'city' : (ALL_PROVINCES.includes(city) ? 'province' : 'city');
            const pinyinData = getPinyin(city);
            insertLocationMapping.run(city, type, province || null, pinyinData.pinyin, pinyinData.firstLetter);
            processedLocations.add(city);
          }
        }
      }
    }
    
    if (job.education && job.education.includes(',')) {
      const cleaned = splitAndCleanEducation(job.education);
      if (cleaned.length > 0) {
        const newEducation = cleaned.join(',');
        if (newEducation !== job.education) {
          updateEducationStmt.run(newEducation, job.id);
          educationUpdated++;
        }
        
        for (const edu of cleaned) {
          if (!processedEducations.has(edu)) {
            const level = EDUCATION_LEVELS[edu]?.level ?? 99;
            const alias = EDUCATION_LEVELS[edu]?.alias?.join(',') || '';
            insertEducationMapping.run(edu, level, alias);
            processedEducations.add(edu);
          }
        }
      }
    }
    
    if ((locationUpdated + educationUpdated) % 500 === 0 && (locationUpdated + educationUpdated) > 0) {
      console.log(`已处理: 地点更新 ${locationUpdated} 条, 学历更新 ${educationUpdated} 条`);
    }
  }
});

transaction();

for (const [name, data] of Object.entries(EDUCATION_LEVELS)) {
  if (!processedEducations.has(name)) {
    insertEducationMapping.run(name, data.level, data.alias.join(','));
    processedEducations.add(name);
  }
}

const locationCount = db.prepare('SELECT COUNT(*) as count FROM location_mapping').get();
const educationCount = db.prepare('SELECT COUNT(*) as count FROM education_mapping').get();

db.close();

console.log('\n清洗完成！');
console.log(`- 地点更新: ${locationUpdated} 条`);
console.log(`- 学历更新: ${educationUpdated} 条`);
console.log(`\n数据库统计:`);
console.log(`- 地点映射记录: ${locationCount.count} 条`);
console.log(`- 学历映射记录: ${educationCount.count} 条`);
