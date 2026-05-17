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

const PINYIN_MAP = {
  '北京': { pinyin: 'beijing', firstLetter: 'bj' },
  '天津': { pinyin: 'tianjin', firstLetter: 'tj' },
  '上海': { pinyin: 'shanghai', firstLetter: 'sh' },
  '重庆': { pinyin: 'chongqing', firstLetter: 'cq' },
  '石家庄': { pinyin: 'shijiazhuang', firstLetter: 'sjz' },
  '唐山': { pinyin: 'tangshan', firstLetter: 'ts' },
  '秦皇岛': { pinyin: 'qinhuangdao', firstLetter: 'qhd' },
  '邯郸': { pinyin: 'handan', firstLetter: 'hd' },
  '太原': { pinyin: 'taiyuan', firstLetter: 'ty' },
  '大同': { pinyin: 'datong', firstLetter: 'dt' },
  '沈阳': { pinyin: 'shenyang', firstLetter: 'sy' },
  '大连': { pinyin: 'dalian', firstLetter: 'dl' },
  '长春': { pinyin: 'changchun', firstLetter: 'cc' },
  '吉林': { pinyin: 'jilin', firstLetter: 'jl' },
  '哈尔滨': { pinyin: 'haerbin', firstLetter: 'heb' },
  '南京': { pinyin: 'nanjing', firstLetter: 'nj' },
  '无锡': { pinyin: 'wuxi', firstLetter: 'wx' },
  '徐州': { pinyin: 'xuzhou', firstLetter: 'xz' },
  '常州': { pinyin: 'changzhou', firstLetter: 'cz' },
  '苏州': { pinyin: 'suzhou', firstLetter: 'sz' },
  '南通': { pinyin: 'nantong', firstLetter: 'nt' },
  '杭州': { pinyin: 'hangzhou', firstLetter: 'hz' },
  '宁波': { pinyin: 'ningbo', firstLetter: 'nb' },
  '温州': { pinyin: 'wenzhou', firstLetter: 'wz' },
  '嘉兴': { pinyin: 'jiaxing', firstLetter: 'jx' },
  '合肥': { pinyin: 'hefei', firstLetter: 'hf' },
  '芜湖': { pinyin: 'wuhu', firstLetter: 'wh' },
  '福州': { pinyin: 'fuzhou', firstLetter: 'fz' },
  '厦门': { pinyin: 'xiamen', firstLetter: 'xm' },
  '南昌': { pinyin: 'nanchang', firstLetter: 'nc' },
  '济南': { pinyin: 'jinan', firstLetter: 'jn' },
  '青岛': { pinyin: 'qingdao', firstLetter: 'qd' },
  '郑州': { pinyin: 'zhengzhou', firstLetter: 'zz' },
  '武汉': { pinyin: 'wuhan', firstLetter: 'wh' },
  '长沙': { pinyin: 'changsha', firstLetter: 'cs' },
  '广州': { pinyin: 'guangzhou', firstLetter: 'gz' },
  '深圳': { pinyin: 'shenzhen', firstLetter: 'sz' },
  '珠海': { pinyin: 'zhuhai', firstLetter: 'zh' },
  '海口': { pinyin: 'haikou', firstLetter: 'hk' },
  '三亚': { pinyin: 'sanya', firstLetter: 'sy' },
  '成都': { pinyin: 'chengdu', firstLetter: 'cd' },
  '绵阳': { pinyin: 'mianyang', firstLetter: 'my' },
  '德阳': { pinyin: 'deyang', firstLetter: 'dy' },
  '贵阳': { pinyin: 'guiyang', firstLetter: 'gy' },
  '昆明': { pinyin: 'kunming', firstLetter: 'km' },
  '西安': { pinyin: 'xian', firstLetter: 'xa' },
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
  '高雄': { pinyin: 'gaoxiong', firstLetter: 'gx' },
  '河北': { pinyin: 'hebei', firstLetter: 'hb' },
  '山西': { pinyin: 'shanxi', firstLetter: 'sx' },
  '辽宁': { pinyin: 'liaoning', firstLetter: 'ln' },
  '吉林': { pinyin: 'jilin', firstLetter: 'jl' },
  '黑龙江': { pinyin: 'heilongjiang', firstLetter: 'hlj' },
  '江苏': { pinyin: 'jiangsu', firstLetter: 'js' },
  '浙江': { pinyin: 'zhejiang', firstLetter: 'zj' },
  '安徽': { pinyin: 'anhui', firstLetter: 'ah' },
  '福建': { pinyin: 'fujian', firstLetter: 'fj' },
  '江西': { pinyin: 'jiangxi', firstLetter: 'jx' },
  '山东': { pinyin: 'shandong', firstLetter: 'sd' },
  '河南': { pinyin: 'henan', firstLetter: 'hn' },
  '湖北': { pinyin: 'hubei', firstLetter: 'hb' },
  '湖南': { pinyin: 'hunan', firstLetter: 'hn' },
  '广东': { pinyin: 'guangdong', firstLetter: 'gd' },
  '海南': { pinyin: 'hainan', firstLetter: 'hn' },
  '四川': { pinyin: 'sichuan', firstLetter: 'sc' },
  '贵州': { pinyin: 'guizhou', firstLetter: 'gz' },
  '云南': { pinyin: 'yunnan', firstLetter: 'yn' },
  '陕西': { pinyin: 'shaanxi', firstLetter: 'sx' },
  '甘肃': { pinyin: 'gansu', firstLetter: 'gs' },
  '青海': { pinyin: 'qinghai', firstLetter: 'qh' },
  '内蒙古': { pinyin: 'neimenggu', firstLetter: 'nmg' },
  '广西': { pinyin: 'guangxi', firstLetter: 'gx' },
  '西藏': { pinyin: 'xizang', firstLetter: 'xz' },
  '宁夏': { pinyin: 'ningxia', firstLetter: 'nx' },
  '新疆': { pinyin: 'xinjiang', firstLetter: 'xj' },
  '台湾': { pinyin: 'taiwan', firstLetter: 'tw' },
};

function getPinyin(name) {
  return PINYIN_MAP[name]?.pinyin || name.toLowerCase();
}

function getFirstLetter(name) {
  return PINYIN_MAP[name]?.firstLetter || name.substring(0, 2).toLowerCase();
}

console.log('开始初始化地点映射数据库...');

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

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO location_mapping (name, type, province, pinyin, first_letter)
  VALUES (?, ?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  let count = 0;
  
  for (const [province, cities] of Object.entries(PROVINCE_CITY_MAP)) {
    insertStmt.run(province, 'province', null, getPinyin(province), getFirstLetter(province));
    count++;
    
    for (const city of cities) {
      insertStmt.run(city, 'city', province, getPinyin(city), getFirstLetter(city));
      count++;
    }
  }
  
  console.log('已插入 ' + count + ' 条地点映射记录');
});

transaction();

const result = db.prepare('SELECT COUNT(*) as count FROM location_mapping').get();
console.log('数据库中共有 ' + result.count + ' 条地点映射记录');

db.close();

console.log('初始化完成！');
