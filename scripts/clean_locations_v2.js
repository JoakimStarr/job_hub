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

const DISTRICT_REMOVAL_PATTERNS = [
  /市[^\s,，、]+区/g,
  /省[^\s,，、]+市/g,
  /自治区[^\s,，、]+/g,
  /特别行政区/g,
  /直辖县级行政区划/g,
  /市辖区/g,
];

const PINYIN_MAP = {
  '北京': { pinyin: 'beijing', firstLetter: 'bj' },
  '天津': 'tianjin', '上海': 'shanghai', '重庆': 'chongqing',
  '石家庄': 'shijiazhuang', '唐山': 'tangshan', '秦皇岛': 'qinhuangdao',
  '邯郸': 'handan', '太原': 'taiyuan', '大同': 'datong',
  '沈阳': 'shenyang', '大连': 'dalian', '鞍山': 'anshan',
  '长春': 'changchun', '吉林': 'jilin', '哈尔滨': 'haerbin',
  '南京': 'nanjing', '无锡': 'wuxi', '徐州': 'xuzhou',
  '常州': 'changzhou', '苏州': 'suzhou', '南通': 'nantong',
  '杭州': 'hangzhou', '宁波': 'ningbo', '温州': 'wenzhou',
  '嘉兴': 'jiaxing', '湖州': 'huzhou', '绍兴': 'shaoxing',
  '合肥': 'hefei', '芜湖': 'wuhu', '蚌埠': 'bengbu',
  '福州': 'fuzhou', '厦门': 'xiamen', '莆田': 'putian',
  '南昌': 'nanchang', '九江': 'jiujiang', '景德镇': 'jingdezhen',
  '济南': 'jinan', '青岛': 'qingdao', '烟台': 'yantai',
  '潍坊': 'weifang', '威海': 'weihai', '临沂': 'linyi',
  '郑州': 'zhengzhou', '洛阳': 'luoyang', '开封': 'kaifeng',
  '武汉': 'wuhan', '宜昌': 'yichang', '襄阳': 'xiangyang',
  '长沙': 'changsha', '株洲': 'zhuzhou', '湘潭': 'xiangtan',
  '广州': 'guangzhou', '深圳': 'shenzhen', '珠海': 'zhuhai',
  '佛山': 'foshan', '东莞': 'dongguan', '中山': 'zhongshan',
  '海口': 'haikou', '三亚': 'sanya',
  '成都': 'chengdu', '绵阳': 'mianyang', '德阳': 'deyang',
  '宜宾': 'yibin', '泸州': 'luzhou', '南充': 'nanchong',
  '贵阳': 'guiyang', '遵义': 'zunyi', '昆明': 'kunming',
  '西安': 'xian', '咸阳': 'xianyang', '兰州': 'lanzhou',
  '西宁': 'xining', '银川': 'yinchuan', '乌鲁木齐': 'wulumuqi',
  '呼和浩特': 'huhehaote', '南宁': 'nanning', '桂林': 'guilin',
  '拉萨': 'lasa', '香港': 'xianggang', '澳门': 'aomen',
  '台北': 'taibei', '高雄': 'gaoxiong',
  '河北': 'hebei', '山西': 'shanxi', '辽宁': 'liaoning',
  '吉林': 'jilin', '黑龙江': 'heilongjiang', '江苏': 'jiangsu',
  '浙江': 'zhejiang', '安徽': 'anhui', '福建': 'fujian',
  '江西': 'jiangxi', '山东': 'shandong', '河南': 'henan',
  '湖北': 'hubei', '湖南': 'hunan', '广东': 'guangdong',
  '海南': 'hainan', '四川': 'sichuan', '贵州': 'guizhou',
  '云南': 'yunnan', '陕西': 'shaanxi', '甘肃': 'gansu',
  '青海': 'qinghai', '内蒙古': 'neimenggu', '广西': 'guangxi',
  '西藏': 'xizang', '宁夏': 'ningxia', '新疆': 'xinjiang',
  '台湾': 'taiwan',
};

function getPinyin(name) {
  const data = PINYIN_MAP[name];
  if (typeof data === 'string') {
    return { pinyin: data, firstLetter: data.substring(0, 2) };
  }
  if (typeof data === 'object') {
    return data;
  }
  return { pinyin: name.toLowerCase(), firstLetter: name.substring(0, 2).toLowerCase() };
}

function normalizeCity(location) {
  if (!location) return '';
  
  let normalized = location.trim();
  
  for (const pattern of DISTRICT_REMOVAL_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }
  
  normalized = normalized
    .replace(/省$/g, '')
    .replace(/市$/g, '')
    .replace(/县$/g, '')
    .replace(/区$/g, '')
    .trim();
  
  if (normalized.startsWith('浙江省') || normalized.startsWith('江苏省') || 
      normalized.startsWith('广东省') || normalized.startsWith('山东省') ||
      normalized.startsWith('四川省') || normalized.startsWith('辽宁省') ||
      normalized.startsWith('湖北省') || normalized.startsWith('河南省')) {
    normalized = normalized.replace(/^.+省/, '');
  }
  
  if (normalized.startsWith('上海市') || normalized.startsWith('北京市') || 
      normalized.startsWith('天津市') || normalized.startsWith('重庆市')) {
    normalized = normalized.replace(/^.+市/, '');
    if (normalized.includes('浦东') || normalized.includes('新区') || 
        normalized.includes('朝阳') || normalized.includes('海淀') ||
        normalized.includes('东城') || normalized.includes('西城') ||
        normalized.includes('丰台') || normalized.includes('怀柔')) {
      normalized = normalized.substring(0, 2);
      if (normalized === '浦东') normalized = '上海';
    }
  }
  
  if (normalized.length < 2) {
    return location;
  }
  
  if (ALL_CITIES.includes(normalized)) {
    return normalized;
  }
  
  if (ALL_PROVINCES.includes(normalized)) {
    return normalized;
  }
  
  for (const city of ALL_CITIES) {
    if (normalized.includes(city)) {
      return city;
    }
  }
  
  for (const province of ALL_PROVINCES) {
    if (normalized.includes(province)) {
      return province;
    }
  }
  
  return normalized;
}

function splitLocations(location) {
  if (!location) return [];
  
  const separators = [',', '，', '、', '/', '|', ' '];
  let parts = [location];
  
  for (const sep of separators) {
    parts = parts.flatMap(p => p.split(sep));
  }
  
  return parts
    .map(p => p.trim())
    .filter(p => p.length >= 2)
    .map(normalizeCity)
    .filter(p => p.length >= 2);
}

function cleanLocation(location) {
  const cities = splitLocations(location);
  const uniqueCities = [...new Set(cities)];
  return uniqueCities.slice(0, 3).join(',');
}

console.log('开始清理地点数据...');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS location_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'city',
    province TEXT,
    pinyin TEXT,
    first_letter TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_location_name ON location_mapping(name);
  CREATE INDEX IF NOT EXISTS idx_location_pinyin ON location_mapping(pinyin);
  CREATE INDEX IF NOT EXISTS idx_location_first_letter ON location_mapping(first_letter);
  CREATE INDEX IF NOT EXISTS idx_location_province ON location_mapping(province);
`);

const jobs = db.prepare("SELECT id, location FROM jobs WHERE location IS NOT NULL AND location != ''").all();
console.log(`共有 ${jobs.length} 条记录需要处理`);

const updateStmt = db.prepare('UPDATE jobs SET location = ? WHERE id = ?');
const insertMappingStmt = db.prepare(`
  INSERT OR REPLACE INTO location_mapping (name, type, province, pinyin, first_letter)
  VALUES (?, ?, ?, ?, ?)
`);

let updatedJobs = 0;
let insertedMappings = 0;
const processedNames = new Set();

const transaction = db.transaction(() => {
  for (const job of jobs) {
    const cleaned = cleanLocation(job.location);
    
    if (cleaned !== job.location) {
      updateStmt.run(cleaned, job.id);
      updatedJobs++;
    }
    
    const cities = cleaned.split(',').filter(c => c.trim());
    for (const city of cities) {
      if (!processedNames.has(city)) {
        const province = CITY_TO_PROVINCE[city];
        const type = province ? 'city' : (ALL_PROVINCES.includes(city) ? 'province' : 'city');
        const pinyinData = getPinyin(city);
        
        insertMappingStmt.run(city, type, province || null, pinyinData.pinyin, pinyinData.firstLetter);
        processedNames.add(city);
        insertedMappings++;
      }
    }
    
    if ((updatedJobs) % 500 === 0) {
      console.log(`已处理 ${updatedJobs}/${jobs.length} 条，更新 ${updatedJobs} 条`);
    }
  }
});

transaction();

const mappingCount = db.prepare('SELECT COUNT(*) as count FROM location_mapping').get();
const provinceCount = db.prepare("SELECT COUNT(*) as count FROM location_mapping WHERE type = 'province'").get();
const cityCount = db.prepare("SELECT COUNT(*) as count FROM location_mapping WHERE type = 'city'").get();

db.close();

console.log('\n清理完成！');
console.log(`- 更新岗位记录: ${updatedJobs} 条`);
console.log(`- 插入地点映射: ${insertedMappings} 条`);
console.log(`\n数据库统计:`);
console.log(`- 总映射记录: ${mappingCount.count} 条`);
console.log(`- 省份记录: ${provinceCount.count} 条`);
console.log(`- 城市记录: ${cityCount.count} 条`);
