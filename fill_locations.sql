-- 完整中国省市区划数据
-- 包含: 34个省级行政区 + 全部地级市 + 直辖市区
-- 执行方式: sqlite3 data/jobs.db < fill_locations.sql

-- ============================================
-- 第一部分: 省份 (province) - 34个
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('北京', 'province', '北京', 'beijing', 'B'),
('天津', 'province', '天津', 'tianjin', 'T'),
('上海', 'province', '上海', 'shanghai', 'S'),
('重庆', 'province', '重庆', 'chongqing', 'C'),
('河北', 'province', '河北', 'hebei', 'H'),
('山西', 'province', '山西', 'shanxi', 'S'),
('内蒙古', 'province', '内蒙古', 'neimenggu', 'N'),
('辽宁', 'province', '辽宁', 'liaoning', 'L'),
('吉林', 'province', '吉林', 'jilin', 'J'),
('黑龙江', 'province', '黑龙江', 'heilongjiang', 'H'),
('江苏', 'province', '江苏', 'jiangsu', 'J'),
('浙江', 'province', '浙江', 'zhejiang', 'Z'),
('安徽', 'province', '安徽', 'anhui', 'A'),
('福建', 'province', '福建', 'fujian', 'F'),
('江西', 'province', '江西', 'jiangxi', 'J'),
('山东', 'province', '山东', 'shandong', 'S'),
('河南', 'province', '河南', 'henan', 'H'),
('湖北', 'province', '湖北', 'hubei', 'H'),
('湖南', 'province', '湖南', 'hunan', 'H'),
('广东', 'province', '广东', 'guangdong', 'G'),
('广西', 'province', '广西', 'guangxi', 'G'),
('海南', 'province', '海南', 'hainan', 'H'),
('四川', 'province', '四川', 'sichuan', 'S'),
('贵州', 'province', '贵州', 'guizhou', 'G'),
('云南', 'province', '云南', 'yunnan', 'Y'),
('西藏', 'province', '西藏', 'xizang', 'X'),
('陕西', 'province', '陕西', 'shanxi_shanxi', 'S'),
('甘肃', 'province', '甘肃', 'gansu', 'G'),
('青海', 'province', '青海', 'qinghai', 'Q'),
('宁夏', 'province', '宁夏', 'ningxia', 'N'),
('新疆', 'province', '新疆', 'xinjiang', 'X'),
('香港', 'province', '香港', 'xianggang', 'X'),
('澳门', 'province', '澳门', 'aomen', 'A'),
('台湾', 'province', '台湾', 'taiwan', 'T');

-- ============================================
-- 第二部分: 城市 - 北京 (16区)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('东城区', 'city', '北京', 'dongchengqu', 'D'),
('西城区', 'city', '北京', 'xichengqu', 'X'),
('朝阳区', 'city', '北京', 'chaoyangqu', 'C'),
('丰台区', 'city', '北京', 'fengtaiqu', 'F'),
('石景山区', 'city', '北京', 'shijingshanqu', 'S'),
('海淀区', 'city', '北京', 'haidianqu', 'H'),
('门头沟区', 'city', '北京', 'mentougouqu', 'M'),
('房山区', 'city', '北京', 'fangshanqu', 'F'),
('通州区', 'city', '北京', 'tongzhouqu', 'T'),
('顺义区', 'city', '北京', 'shunyiqu', 'S'),
('昌平区', 'city', '北京', 'changpingqu', 'C'),
('大兴区', 'city', '北京', 'daxingqu', 'D'),
('怀柔区', 'city', '北京', 'huairouqu', 'H'),
('平谷区', 'city', '北京', 'pingguqu', 'P'),
('密云区', 'city', '北京', 'miyunqu', 'M'),
('延庆区', 'city', '北京', 'yanqingqu', 'Y');

-- ============================================
-- 第三部分: 城市 - 天津 (16区)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('和平区', 'city', '天津', 'hepingqu', 'H'),
('河东区', 'city', '天津', 'hedongqu', 'H'),
('河西区', 'city', '天津', 'hexiqu', 'H'),
('南开区', 'city', '天津', 'nankaiqu', 'N'),
('河北区', 'city', '天津', 'hebeiqu', 'H'),
('红桥区', 'city', '天津', 'hongqiaoqu', 'H'),
('东丽区', 'city', '天津', 'dongliqu', 'D'),
('西青区', 'city', '天津', 'xiqingqu', 'X'),
('津南区', 'city', '天津', 'jinnanqu', 'J'),
('北辰区', 'city', '天津', 'beichenqu', 'B'),
('武清区', 'city', '天津', 'wuqingqu', 'W'),
('宝坻区', 'city', '天津', 'baodiqu', 'B'),
('滨海新区', 'city', '天津', 'binhaixinqu', 'B'),
('宁河区', 'city', '天津', 'ninghequ', 'N'),
('静海区', 'city', '天津', 'jinghaiqu', 'J'),
('蓟州区', 'city', '天津', 'jizhouqu', 'J');

-- ============================================
-- 第四部分: 城市 - 上海 (16区)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('黄浦区', 'city', '上海', 'huangpuqu', 'H'),
('徐汇区', 'city', '上海', 'xuhuiqu', 'X'),
('长宁区', 'city', '上海', 'changningqu', 'C'),
('静安区', 'city', '上海', 'jinganqu', 'J'),
('普陀区', 'city', '上海', 'putuoqu', 'P'),
('虹口区', 'city', '上海', 'hongkouqu', 'H'),
('杨浦区', 'city', '上海', 'yangpuqu', 'Y'),
('闵行区', 'city', '上海', 'minhangqu', 'M'),
('宝山区', 'city', '上海', 'baoshanqu', 'B'),
('嘉定区', 'city', '上海', 'jiadingqu', 'J'),
('浦东新区', 'city', '上海', 'pudongxinqu', 'P'),
('金山区', 'city', '上海', 'jinshanqu', 'J'),
('松江区', 'city', '上海', 'songjiangqu', 'S'),
('青浦区', 'city', '上海', 'qingpuqu', 'Q'),
('奉贤区', 'city', '上海', 'fengxianqu', 'F'),
('崇明区', 'city', '上海', 'chongmingqu', 'C');

-- ============================================
-- 第五部分: 城市 - 重庆 (26区县)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('万州区', 'city', '重庆', 'wanzhouqu', 'W'),
('涪陵区', 'city', '重庆', 'fulingqu', 'F'),
('渝中区', 'city', '重庆', 'yuzhongqu', 'Y'),
('大渡口区', 'city', '重庆', 'dadukouqu', 'D'),
('江北区', 'city', '重庆', 'jiangbeiqu', 'J'),
('沙坪坝区', 'city', '重庆', 'shapingbaqu', 'S'),
('九龙坡区', 'city', '重庆', 'jiulongpoqu', 'J'),
('南岸区', 'city', '重庆', 'nananqu', 'N'),
('北碚区', 'city', '重庆', 'beibeiqu', 'B'),
('綦江区', 'city', '重庆', 'qijiangqu', 'Q'),
('大足区', 'city', '重庆', 'dazuqu', 'D'),
('渝北区', 'city', '重庆', 'yubeiqu', 'Y'),
('巴南区', 'city', '重庆', 'bananqu', 'B'),
('黔江区', 'city', '重庆', 'qianjiangqu', 'Q'),
('长寿区', 'city', '重庆', 'changshouqu', 'C'),
('江津区', 'city', '重庆', 'jiangjinqu', 'J'),
('合川区', 'city', '重庆', 'hechuanqu', 'H'),
('永川区', 'city', '重庆', 'yongchuanqu', 'Y'),
('南川区', 'city', '重庆', 'nanchuanqu', 'N'),
('璧山区', 'city', '重庆', 'bishanqu', 'B'),
('铜梁区', 'city', '重庆', 'tongliangqu', 'T'),
('潼南区', 'city', '重庆', 'tongnanqu', 'T'),
('荣昌区', 'city', '重庆', 'rongchangqu', 'R'),
('开州区', 'city', '重庆', 'kaizhouqu', 'K'),
('梁平区', 'city', '重庆', 'liangpingqu', 'L'),
('武隆区', 'city', '重庆', 'wulongqu', 'W');

-- ============================================
-- 第六部分: 城市 - 河北 (11地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('石家庄', 'city', '河北', 'shijiazhuang', 'S'),
('唐山', 'city', '河北', 'tangshan', 'T'),
('秦皇岛', 'city', '河北', 'qinhuangdao', 'Q'),
('邯郸', 'city', '河北', 'handan', 'H'),
('邢台', 'city', '河北', 'xingtai', 'X'),
('保定', 'city', '河北', 'baoding', 'B'),
('张家口', 'city', '河北', 'zhangjiakou', 'Z'),
('承德', 'city', '河北', 'chengde', 'C'),
('沧州', 'city', '河北', 'cangzhou', 'C'),
('廊坊', 'city', '河北', 'langfang', 'L'),
('衡水', 'city', '河北', 'hengshui', 'H'),
('雄安新区', 'city', '河北', 'xiongxinqu', 'X');

-- ============================================
-- 第七部分: 城市 - 山西 (11地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('太原', 'city', '山西', 'taiyuan', 'T'),
('大同', 'city', '山西', 'datong', 'D'),
('阳泉', 'city', '山西', 'yangquan', 'Y'),
('长治', 'city', '山西', 'changzhi', 'C'),
('晋城', 'city', '山西', 'jincheng', 'J'),
('朔州', 'city', '山西', 'shuozhou', 'S'),
('晋中', 'city', '山西', 'jinzhong', 'J'),
('运城', 'city', '山西', 'yuncheng', 'Y'),
('忻州', 'city', '山西', 'xinzhou', 'X'),
('临汾', 'city', '山西', 'linfen', 'L'),
('吕梁', 'city', '山西', 'lvliang', 'L');

-- ============================================
-- 第八部分: 城市 - 内蒙古 (9地级市+3盟)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('呼和浩特', 'city', '内蒙古', 'huhehaote', 'H'),
('包头', 'city', '内蒙古', 'baotou', 'B'),
('乌海', 'city', '内蒙古', 'wuhai', 'W'),
('赤峰', 'city', '内蒙古', 'chifeng', 'C'),
('通辽', 'city', '内蒙古', 'tongliao', 'T'),
('鄂尔多斯', 'city', '内蒙古', 'eerduosi', 'E'),
('呼伦贝尔', 'city', '内蒙古', 'hulunbeier', 'H'),
('巴彦淖尔', 'city', '内蒙古', 'bayannaoer', 'B'),
('乌兰察布', 'city', '内蒙古', 'wulanchabu', 'W'),
('兴安盟', 'city', '内蒙古', 'xinganmeng', 'X'),
('锡林郭勒盟', 'city', '内蒙古', 'xilinguolemeng', 'X'),
('阿拉善盟', 'city', '内蒙古', 'alashanmeng', 'A');

-- ============================================
-- 第九部分: 城市 - 辽宁 (14地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('沈阳', 'city', '辽宁', 'shenyang', 'S'),
('大连', 'city', '辽宁', 'dalian', 'D'),
('鞍山', 'city', '辽宁', 'anshan', 'A'),
('抚顺', 'city', '辽宁', 'fushun', 'F'),
('本溪', 'city', '辽宁', 'benxi', 'B'),
('丹东', 'city', '辽宁', 'dandong', 'D'),
('锦州', 'city', '辽宁', 'jinzhou', 'J'),
('营口', 'city', '辽宁', 'yingkou', 'Y'),
('阜新', 'city', '辽宁', 'fuxin', 'F'),
('辽阳', 'city', '辽宁', 'liaoyang', 'L'),
('盘锦', 'city', '辽宁', 'panjin', 'P'),
('铁岭', 'city', '辽宁', 'tieling', 'T'),
('朝阳', 'city', '辽宁', 'chaoyang', 'C'),
('葫芦岛', 'city', '辽宁', 'huludao', 'H');

-- ============================================
-- 第十部分: 城市 - 吉林 (8地级市+1自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('长春', 'city', '吉林', 'changchun', 'C'),
('吉林', 'city', '吉林', 'jilin', 'J'),
('四平', 'city', '吉林', 'siping', 'S'),
('辽源', 'city', '吉林', 'liaoyuan', 'L'),
('通化', 'city', '吉林', 'tonghua', 'T'),
('白山', 'city', '吉林', 'baishan', 'B'),
('松原', 'city', '吉林', 'songyuan', 'S'),
('白城', 'city', '吉林', 'baicheng', 'B'),
('延边朝鲜族自治州', 'city', '吉林', 'yanbian', 'Y');

-- ============================================
-- 第十一部分: 城市 - 黑龙江 (12地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('哈尔滨', 'city', '黑龙江', 'haerbin', 'H'),
('齐齐哈尔', 'city', '黑龙江', 'qiqihaer', 'Q'),
('鸡西', 'city', '黑龙江', 'jixi', 'J'),
('鹤岗', 'city', '黑龙江', 'hegang', 'H'),
('双鸭山', 'city', '黑龙江', 'shuangyashan', 'S'),
('大庆', 'city', '黑龙江', 'daqing', 'D'),
('伊春', 'city', '黑龙江', 'yichun', 'Y'),
('佳木斯', 'city', '黑龙江', 'jiamusi', 'J'),
('七台河', 'city', '黑龙江', 'qitaihe', 'Q'),
('牡丹江', 'city', '黑龙江', 'mudanjiang', 'M'),
('黑河', 'city', '黑龙江', 'heihe', 'H'),
('绥化', 'city', '黑龙江', 'suihua', 'S'),
('大兴安岭地区', 'city', '黑龙江', 'daxinganling', 'D');

-- ============================================
-- 第十二部分: 城市 - 江苏 (13地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('南京', 'city', '江苏', 'nanjing', 'N'),
('无锡', 'city', '江苏', 'wuxi', 'W'),
('徐州', 'city', '江苏', 'xuzhou', 'X'),
('常州', 'city', '江苏', 'changzhou', 'C'),
('苏州', 'city', '江苏', 'suzhou', 'S'),
('南通', 'city', '江苏', 'nantong', 'N'),
('连云港', 'city', '江苏', 'lianyungang', 'L'),
('淮安', 'city', '江苏', 'huaian', 'H'),
('盐城', 'city', '江苏', 'yancheng', 'Y'),
('扬州', 'city', '江苏', 'yangzhou', 'Y'),
('镇江', 'city', '江苏', 'zhenjiang', 'Z'),
('泰州', 'city', '江苏', 'taizhou', 'T'),
('宿迁', 'city', '江苏', 'suqian', 'S');

-- ============================================
-- 第十三部分: 城市 - 浙江 (11地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('杭州', 'city', '浙江', 'hangzhou', 'H'),
('宁波', 'city', '浙江', 'ningbo', 'N'),
('温州', 'city', '浙江', 'wenzhou', 'W'),
('嘉兴', 'city', '浙江', 'jiaxing', 'J'),
('湖州', 'city', '浙江', 'huzhou', 'H'),
('绍兴', 'city', '浙江', 'shaoxing', 'S'),
('金华', 'city', '浙江', 'jinhua', 'J'),
('衢州', 'city', '浙江', 'quzhou', 'Q'),
('舟山', 'city', '浙江', 'zhoushan', 'Z'),
('台州', 'city', '浙江', 'taizhou', 'T'),
('丽水', 'city', '浙江', 'lishui', 'L');

-- ============================================
-- 第十四部分: 城市 - 安徽 (16地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('合肥', 'city', '安徽', 'hefei', 'H'),
('芜湖', 'city', '安徽', 'wuhu', 'W'),
('蚌埠', 'city', '安徽', 'bengbu', 'B'),
('淮南', 'city', '安徽', 'huainan', 'H'),
('马鞍山', 'city', '安徽', 'maanshan', 'M'),
('淮北', 'city', '安徽', 'huaibei', 'H'),
('铜陵', 'city', '安徽', 'tongling', 'T'),
('安庆', 'city', '安徽', 'anqing', 'A'),
('黄山', 'city', '安徽', 'huangshan', 'H'),
('滁州', 'city', '安徽', 'chuzhou', 'C'),
('阜阳', 'city', '安徽', 'fuyang', 'F'),
('宿州', 'city', '安徽', 'suzhou', 'S'),
('六安', 'city', '安徽', 'luan', 'L'),
('亳州', 'city', '安徽', 'bozhou', 'B'),
('池州', 'city', '安徽', 'chizhou', 'C'),
('宣城', 'city', '安徽', 'xuancheng', 'X');

-- ============================================
-- 第十五部分: 城市 - 福建 (9地级市+1平潭综合实验区)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('福州', 'city', '福建', 'fuzhou', 'F'),
('厦门', 'city', '福建', 'xiamen', 'X'),
('莆田', 'city', '福建', 'putian', 'P'),
('三明', 'city', '福建', 'sanming', 'S'),
('泉州', 'city', '福建', 'quanzhou', 'Q'),
('漳州', 'city', '福建', 'zhangzhou', 'Z'),
('南平', 'city', '福建', 'nanping', 'N'),
('龙岩', 'city', '福建', 'longyan', 'L'),
('宁德', 'city', '福建', 'ningde', 'N'),
('平潭综合实验区', 'city', '福建', 'pingtan', 'P');

-- ============================================
-- 第十六部分: 城市 - 江西 (11地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('南昌', 'city', '江西', 'nanchang', 'N'),
('景德镇', 'city', '江西', 'jingdezhen', 'J'),
('萍乡', 'city', '江西', 'pingxiang', 'P'),
('九江', 'city', '江西', 'jiujiang', 'J'),
('新余', 'city', '江西', 'xinyu', 'X'),
('鹰潭', 'city', '江西', 'yingtan', 'Y'),
('赣州', 'city', '江西', 'ganzhou', 'G'),
('吉安', 'city', '江西', 'jian', 'J'),
('宜春', 'city', '江西', 'yichun', 'Y'),
('抚州', 'city', '江西', 'fuzhou', 'F'),
('上饶', 'city', '江西', 'shangrao', 'S');

-- ============================================
-- 第十七部分: 城市 - 山东 (16地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('济南', 'city', '山东', 'jinan', 'J'),
('青岛', 'city', '山东', 'qingdao', 'Q'),
('淄博', 'city', '山东', 'zibo', 'Z'),
('枣庄', 'city', '山东', 'zaozhuang', 'Z'),
('东营', 'city', '山东', 'dongying', 'D'),
('烟台', 'city', '山东', 'yantai', 'Y'),
('潍坊', 'city', '山东', 'weifang', 'W'),
('济宁', 'city', '山东', 'jining', 'J'),
('泰安', 'city', '山东', 'taian', 'T'),
('威海', 'city', '山东', 'weihai', 'W'),
('日照', 'city', '山东', 'rizhao', 'R'),
('临沂', 'city', '山东', 'linyi', 'L'),
('德州', 'city', '山东', 'dezhou', 'D'),
('聊城', 'city', '山东', 'liaocheng', 'L'),
('滨州', 'city', '山东', 'binzhou', 'B'),
('菏泽', 'city', '山东', 'heze', 'H');

-- ============================================
-- 第十八部分: 城市 - 河南 (17地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('郑州', 'city', '河南', 'zhengzhou', 'Z'),
('开封', 'city', '河南', 'kaifeng', 'K'),
('洛阳', 'city', '河南', 'luoyang', 'L'),
('平顶山', 'city', '河南', 'pingdingshan', 'P'),
('安阳', 'city', '河南', 'anyang', 'A'),
('鹤壁', 'city', '河南', 'hebi', 'H'),
('新乡', 'city', '河南', 'xinxiang', 'X'),
('焦作', 'city', '河南', 'jiaozuo', 'J'),
('濮阳', 'city', '河南', 'puyang', 'P'),
('许昌', 'city', '河南', 'xuchang', 'X'),
('漯河', 'city', '河南', 'luohe', 'L'),
('三门峡', 'city', '河南', 'sanmenxia', 'S'),
('南阳', 'city', '河南', 'nanyang', 'N'),
('商丘', 'city', '河南', 'shangqiu', 'S'),
('信阳', 'city', '河南', 'xinyang', 'X'),
('周口', 'city', '河南', 'zhoukou', 'Z'),
('驻马店', 'city', '河南', 'zhumadian', 'Z'),
('济源', 'city', '河南', 'jiyuan', 'J');

-- ============================================
-- 第十九部分: 城市 - 湖北 (13地级市+3直管市+1自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('武汉', 'city', '湖北', 'wuhan', 'W'),
('黄石', 'city', '湖北', 'huangshi', 'H'),
('十堰', 'city', '湖北', 'shiyan', 'S'),
('宜昌', 'city', '湖北', 'yichang', 'Y'),
('襄阳', 'city', '湖北', 'xiangyang', 'X'),
('鄂州', 'city', '湖北', 'ezhou', 'E'),
('荆门', 'city', '湖北', 'jingmen', 'J'),
('孝感', 'city', '湖北', 'xiaogan', 'X'),
('荆州', 'city', '湖北', 'jingzhou', 'J'),
('黄冈', 'city', '湖北', 'huanggang', 'H'),
('咸宁', 'city', '湖北', 'xianning', 'X'),
('随州', 'city', '湖北', 'suizhou', 'S'),
('恩施土家族苗族自治州', 'city', '湖北', 'enshi', 'E'),
('仙桃', 'city', '湖北', 'xiantao', 'X'),
('潜江', 'city', '湖北', 'qianjiang', 'Q'),
('天门', 'city', '湖北', 'tianmen', 'T'),
('神农架林区', 'city', '湖北', 'shennongjia', 'S');

-- ============================================
-- 第二十部分: 城市 - 湖南 (14地级市+1自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('长沙', 'city', '湖南', 'changsha', 'C'),
('株洲', 'city', '湖南', 'zhuzhou', 'Z'),
('湘潭', 'city', '湖南', 'xiangtan', 'X'),
('衡阳', 'city', '湖南', 'hengyang', 'H'),
('邵阳', 'city', '湖南', 'shaoyang', 'S'),
('岳阳', 'city', '湖南', 'yueyang', 'Y'),
('常德', 'city', '湖南', 'changde', 'C'),
('张家界', 'city', '湖南', 'zhangjiajie', 'Z'),
('益阳', 'city', '湖南', 'yiyang', 'Y'),
('郴州', 'city', '湖南', 'chenzhou', 'C'),
('永州', 'city', '湖南', 'yongzhou', 'Y'),
('怀化', 'city', '湖南', 'huaihua', 'H'),
('娄底', 'city', '湖南', 'loudi', 'L'),
('湘西土家族苗族自治州', 'city', '湖南', 'xiangxi', 'X');

-- ============================================
-- 第二十一部分: 城市 - 广东 (21地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('广州', 'city', '广东', 'guangzhou', 'G'),
('韶关', 'city', '广东', 'shaoguan', 'S'),
('深圳', 'city', '广东', 'shenzhen', 'S'),
('珠海', 'city', '广东', 'zhuhai', 'Z'),
('汕头', 'city', '广东', 'shantou', 'S'),
('佛山', 'city', '广东', 'foshan', 'F'),
('江门', 'city', '广东', 'jiangmen', 'J'),
('湛江', 'city', '广东', 'zhanjiang', 'Z'),
('茂名', 'city', '广东', 'maoming', 'M'),
('肇庆', 'city', '广东', 'zhaoqing', 'Z'),
('惠州', 'city', '广东', 'huizhou', 'H'),
('梅州', 'city', '广东', 'meizhou', 'M'),
('汕尾', 'city', '广东', 'shanwei', 'S'),
('河源', 'city', '广东', 'heyuan', 'H'),
('阳江', 'city', '广东', 'yangjiang', 'Y'),
('清远', 'city', '广东', 'qingyuan', 'Q'),
('东莞', 'city', '广东', 'dongguan', 'D'),
('中山', 'city', '广东', 'zhongshan', 'Z'),
('潮州', 'city', '广东', 'chaozhou', 'C'),
('揭阳', 'city', '广东', 'jieyang', 'J'),
('云浮', 'city', '广东', 'yunfu', 'Y');

-- ============================================
-- 第二十二部分: 城市 - 广西 (14地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('南宁', 'city', '广西', 'nanning', 'N'),
('柳州', 'city', '广西', 'liuzhou', 'L'),
('桂林', 'city', '广西', 'guilin', 'G'),
('梧州', 'city', '广西', 'wuzhou', 'W'),
('北海', 'city', '广西', 'beihai', 'B'),
('防城港', 'city', '广西', 'fangchenggang', 'F'),
('钦州', 'city', '广西', 'qinzhou', 'Q'),
('贵港', 'city', '广西', 'guigang', 'G'),
('玉林', 'city', '广西', 'yulin', 'Y'),
('百色', 'city', '广西', 'baise', 'B'),
('贺州', 'city', '广西', 'hezhou', 'H'),
('河池', 'city', '广西', 'hechi', 'H'),
('来宾', 'city', '广西', 'laibin', 'L'),
('崇左', 'city', '广西', 'chongzuo', 'C');

-- ============================================
-- 第二十三部分: 城市 - 海南 (4地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('海口', 'city', '海南', 'haikou', 'H'),
('三亚', 'city', '海南', 'sanya', 'S'),
('三沙', 'city', '海南', 'sansha', 'S'),
('儋州', 'city', '海南', 'danzhou', 'D'),
('五指山', 'city', '海南', 'wuzhishan', 'W'),
('琼海', 'city', '海南', 'qionghai', 'Q'),
('文昌', 'city', '海南', 'wenchang', 'W'),
('万宁', 'city', '海南', 'wanning', 'W'),
('东方', 'city', '海南', 'dongfang', 'D');

-- ============================================
-- 第二十四部分: 城市 - 四川 (18地级市+3自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('成都', 'city', '四川', 'chengdu', 'C'),
('自贡', 'city', '四川', 'zigong', 'Z'),
('攀枝花', 'city', '四川', 'panzhihua', 'P'),
('泸州', 'city', '四川', 'luzhou', 'L'),
('德阳', 'city', '四川', 'deyang', 'D'),
('绵阳', 'city', '四川', 'mianyang', 'M'),
('广元', 'city', '四川', 'guangyuan', 'G'),
('遂宁', 'city', '四川', 'suining', 'S'),
('内江', 'city', '四川', 'neijiang', 'N'),
('乐山', 'city', '四川', 'leshan', 'L'),
('南充', 'city', '四川', 'nanchong', 'N'),
('眉山', 'city', '四川', 'meishan', 'M'),
('宜宾', 'city', '四川', 'yibin', 'Y'),
('广安', 'city', '四川', 'guangan', 'G'),
('达州', 'city', '四川', 'dazhou', 'D'),
('雅安', 'city', '四川', 'yaan', 'Y'),
('巴中', 'city', '四川', 'bazhong', 'B'),
('资阳', 'city', '四川', 'ziyang', 'Z'),
('阿坝藏族羌族自治州', 'city', '四川', 'aba', 'A'),
('甘孜藏族自治州', 'city', '四川', 'ganzi', 'G'),
('凉山彝族自治州', 'city', '四川', 'liangshan', 'L');

-- ============================================
-- 第二十五部分: 城市 - 贵州 (6地级市+3自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('贵阳', 'city', '贵州', 'guiyang', 'G'),
('六盘水', 'city', '贵州', 'liupanshui', 'L'),
('遵义', 'city', '贵州', 'zunyi', 'Z'),
('安顺', 'city', '贵州', 'anshun', 'A'),
('毕节', 'city', '贵州', 'bijie', 'B'),
('铜仁', 'city', '贵州', 'tongren', 'T'),
('黔西南布依族苗族自治州', 'city', '贵州', 'qianxinan', 'Q'),
('黔东南苗族侗族自治州', 'city', '贵州', 'qiandongnan', 'Q'),
('黔南布依族苗族自治州', 'city', '贵州', 'qiannan', 'Q');

-- ============================================
-- 第二十六部分: 城市 - 云南 (8地级市+8自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('昆明', 'city', '云南', 'kunming', 'K'),
('曲靖', 'city', '云南', 'qujing', 'Q'),
('玉溪', 'city', '云南', 'yuxi', 'Y'),
('保山', 'city', '云南', 'baoshan', 'B'),
('昭通', 'city', '云南', 'zhaotong', 'Z'),
('丽江', 'city', '云南', 'lijiang', 'L'),
('普洱', 'city', '云南', 'puer', 'P'),
('临沧', 'city', '云南', 'lincang', 'L'),
('楚雄彝族自治州', 'city', '云南', 'chuxiong', 'C'),
('红河哈尼族彝族自治州', 'city', '云南', 'honghe', 'H'),
('文山壮族苗族自治州', 'city', '云南', 'wenshan', 'W'),
('西双版纳傣族自治州', 'city', '云南', 'xishuangbanna', 'X'),
('大理白族自治州', 'city', '云南', 'dali', 'D'),
('德宏傣族景颇族自治州', 'city', '云南', 'dehong', 'D'),
('怒江傈僳族自治州', 'city', '云南', 'nujiang', 'N'),
('迪庆藏族自治州', 'city', '云南', 'diqing', 'D');

-- ============================================
-- 第二十七部分: 城市 - 西藏 (6地级市+1地区)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('拉萨', 'city', '西藏', 'lasa', 'L'),
('日喀则', 'city', '西藏', 'rikaze', 'R'),
('昌都', 'city', '西藏', 'changdu', 'C'),
('林芝', 'city', '西藏', 'linzhi', 'L'),
('山南', 'city', '西藏', 'shannan', 'S'),
('那曲', 'city', '西藏', 'naqu', 'N'),
('阿里地区', 'city', '西藏', 'ali', 'A');

-- ============================================
-- 第二十八部分: 城市 - 陕西 (10地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('西安', 'city', '陕西', 'xian', 'X'),
('铜川', 'city', '陕西', 'tongchuan', 'T'),
('宝鸡', 'city', '陕西', 'baoji', 'B'),
('咸阳', 'city', '陕西', 'xianyang', 'X'),
('渭南', 'city', '陕西', 'weinan', 'W'),
('延安', 'city', '陕西', 'yan''an', 'Y'),
('汉中', 'city', '陕西', 'hanzhong', 'H'),
('榆林', 'city', '陕西', 'yulin', 'Y'),
('安康', 'city', '陕西', 'ankang', 'A'),
('商洛', 'city', '陕西', 'shangluo', 'S');

-- ============================================
-- 第二十九部分: 城市 - 甘肃 (12地级市+2自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('兰州', 'city', '甘肃', 'lanzhou', 'L'),
('嘉峪关', 'city', '甘肃', 'jiayuguan', 'J'),
('金昌', 'city', '甘肃', 'jinchang', 'J'),
('白银', 'city', '甘肃', 'baiyin', 'B'),
('天水', 'city', '甘肃', 'tianshui', 'T'),
('武威', 'city', '甘肃', 'wuwei', 'W'),
('张掖', 'city', '甘肃', 'zhangye', 'Z'),
('平凉', 'city', '甘肃', 'pingliang', 'P'),
('酒泉', 'city', '甘肃', 'jiuquan', 'J'),
('庆阳', 'city', '甘肃', 'qingyang', 'Q'),
('定西', 'city', '甘肃', 'dingxi', 'D'),
('陇南', 'city', '甘肃', 'longnan', 'L'),
('临夏回族自治州', 'city', '甘肃', 'linxia', 'L'),
('甘南藏族自治州', 'city', '甘肃', 'gannan', 'G');

-- ============================================
-- 第三十部分: 城市 - 青海 (2地级市+6自治州)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('西宁', 'city', '青海', 'xining', 'X'),
('海东', 'city', '青海', 'haidong', 'H'),
('海北藏族自治州', 'city', '青海', 'haibei', 'H'),
('黄南藏族自治州', 'city', '青海', 'huangnan', 'H'),
('海南藏族自治州', 'city', '青海', 'hainan', 'H'),
('果洛藏族自治州', 'city', '青海', 'guoluo', 'G'),
('玉树藏族自治州', 'city', '青海', 'yushu', 'Y'),
('海西蒙古族藏族自治州', 'city', '青海', 'haixi', 'H');

-- ============================================
-- 第三十一部分: 城市 - 宁夏 (5地级市)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('银川', 'city', '宁夏', 'yinchuan', 'Y'),
('石嘴山', 'city', '宁夏', 'shizuishan', 'S'),
('吴忠', 'city', '宁夏', 'wuzhong', 'W'),
('固原', 'city', '宁夏', 'guyuan', 'G'),
('中卫', 'city', '宁夏', 'zhongwei', 'Z');

-- ============================================
-- 第三十二部分: 城市 - 新疆 (4地级市+5自治州+5地区)
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('乌鲁木齐', 'city', '新疆', 'wulumuqi', 'W'),
('克拉玛依', 'city', '新疆', 'kelamayi', 'K'),
('吐鲁番', 'city', '新疆', 'tulufan', 'T'),
('哈密', 'city', '新疆', 'hami', 'H'),
('昌吉回族自治州', 'city', '新疆', 'changji', 'C'),
('博尔塔拉蒙古自治州', 'city', '新疆', 'boertala', 'B'),
('巴音郭楞蒙古自治州', 'city', '新疆', 'bayinguoleng', 'B'),
('阿克苏地区', 'city', '新疆', 'akesu', 'A'),
('克孜勒苏柯尔克孜自治州', 'city', '新疆', 'kezilesu', 'K'),
('喀什地区', 'city', '新疆', 'kashi', 'K'),
('和田地区', 'city', '新疆', 'hetian', 'H'),
('伊犁哈萨克自治州', 'city', '新疆', 'yili', 'Y'),
('塔城地区', 'city', '新疆', 'tacheng', 'T'),
('阿勒泰地区', 'city', '新疆', 'aletai', 'A'),
('石河子', 'city', '新疆', 'shihezi', 'S'),
('阿拉尔', 'city', '新疆', 'alaer', 'A'),
('图木舒克', 'city', '新疆', 'tumushuke', 'T'),
('五家渠', 'city', '新疆', 'wujiaqu', 'W'),
('北屯', 'city', '新疆', 'beitun', 'B'),
('铁门关', 'city', '新疆', 'tiemengguan', 'T'),
('双河', 'city', '新疆', 'shuanghe', 'S'),
('可克拉达依', 'city', '新疆', 'kkeladayi', 'K'),
('昆玉', 'city', '新疆', 'kunyu', 'K');

-- ============================================
-- 第三十三部分: 特别行政区
-- ============================================
INSERT OR IGNORE INTO location_mapping (name, type, province, pinyin, first_letter) VALUES
('香港岛', 'city', '香港', 'xianggangdao', 'X'),
('九龙', 'city', '香港', 'jiulong', 'J'),
('新界', 'city', '香港', 'xinjie', 'X'),
('澳门半岛', 'city', '澳门', 'aomenbandao', 'A'),
('氹仔', 'city', '澳门', 'dangzai', 'D'),
('路环', 'city', '澳门', 'luhuan', 'L'),
('台北', 'city', '台湾', 'taibei', 'T'),
('新北', 'city', '台湾', 'xinbei', 'X'),
('桃园', 'city', '台湾', 'taoyuan', 'T'),
('台中', 'city', '台湾', 'taizhong', 'T'),
('台南', 'city', '台湾', 'tainan', 'T'),
('高雄', 'city', '台湾', 'gaoxiong', 'G'),
('基隆', 'city', '台湾', 'jilong', 'J'),
('新竹', 'city', '台湾', 'xinzhu', 'X'),
('嘉义', 'city', '台湾', 'jiayi', 'J');
