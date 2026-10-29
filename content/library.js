import { EXTRA_FONTS } from './font-resources.js';
export const FONTS={zh:[
{id:'inkkai',name:'纸上行楷 · 离线',family:'inkkai',kind:'内嵌',desc:'清楚稳定，适合长诗、长文',sample:'清风徐来，水波不兴。'},
{id:'inksong',name:'古典结构 · 离线',family:'inksong',kind:'内嵌',desc:'较规整的中文结构参考',sample:'春江潮水连海平'},
{id:'Zhi Mang Xing',name:'志莽行书',family:'Zhi Mang Xing',kind:'联网',desc:'放松笔势，更偏行书与标题',sample:'春江花月夜'},
{id:'Long Cang',name:'龙藏',family:'Long Cang',kind:'联网',desc:'较自由的手写字形',sample:'清风徐来，水波不兴。'},
{id:'Liu Jian Mao Cao',name:'刘建毛草',family:'Liu Jian Mao Cao',kind:'联网',desc:'草写表现力强，长文辨认性请自行判断',sample:'山河远阔'},
{id:'Ma Shan Zheng',name:'马善政',family:'Ma Shan Zheng',kind:'联网',desc:'传统毛笔笔意，适合诗词',sample:'春江花月夜'},
{id:'ZCOOL XiaoWei',name:'站酷小薇',family:'ZCOOL XiaoWei',kind:'联网',desc:'偏装饰标题，不是自然笔记行草',sample:'人间烟火，山海远阔'}],
en:[
{id:'inkcomic',name:'清晰手写 · 离线',family:'inkcomic',kind:'内嵌',desc:'适合考试作文、清晰字母',sample:'Practice makes progress.'},
{id:'inkz003',name:'随性手写 · 离线',family:'inkz003',kind:'内嵌',desc:'轻快自由的英文手写风格',sample:'A little progress every day.'},
{id:'inklobster',name:'装饰连笔 · 离线',family:'inklobster',kind:'内嵌',desc:'适合标题和短句，长文请先预览',sample:'Make your own way.'},
{id:'Dancing Script',name:'Dancing Script',family:'Dancing Script',kind:'联网',desc:'优雅斜体连笔',sample:'Make your own way.'},
{id:'Caveat',name:'Caveat',family:'Caveat',kind:'联网',desc:'自然舒展、接近日常英文笔记',sample:'A little progress every day.'},
{id:'Satisfy',name:'Satisfy',family:'Satisfy',kind:'联网',desc:'更有装饰感的连笔',sample:'Practice makes progress.'},...EXTRA_FONTS]};

const spring=`春江潮水连海平，海上明月共潮生。
滟滟随波千万里，何处春江无月明？
江流宛转绕芳甸，月照花林皆似霰。
空里流霜不觉飞，汀上白沙看不见。
江天一色无纤尘，皎皎空中孤月轮。
江畔何人初见月？江月何年初照人？
人生代代无穷已，江月年年望相似。
不知江月待何人？但见长江送流水。
白云一片去悠悠，青枫浦上不胜愁。
谁家今夜扁舟子？何处相思明月楼？
可怜楼上月徘徊，应照离人妆镜台。
玉户帘中卷不去，捣衣砧上拂还来。
此时相望不相闻，愿逐月华流照君。
鸿雁长飞光不度，鱼龙潜跃水成文。
昨夜闲潭梦落花，可怜春半不还家。
江水流春去欲尽，江潭落月复西斜。
斜月沉沉藏海雾，碣石潇湘无限路。
不知乘月几人归，落月摇情满江树。`;
const meng=`海客谈瀛洲，烟涛微茫信难求。
越人语天姥，云霞明灭或可睹。
天姥连天向天横，势拔五岳掩赤城。
天台四万八千丈，对此欲倒东南倾。
我欲因之梦吴越，一夜飞度镜湖月。
湖月照我影，送我至剡溪。
谢公宿处今尚在，渌水荡漾清猿啼。
脚著谢公屐，身登青云梯。
半壁见海日，空中闻天鸡。
千岩万转路不定，迷花倚石忽已暝。
熊咆龙吟殷岩泉，栗深林兮惊层巅。
云青青兮欲雨，水澹澹兮生烟。
列缺霹雳，丘峦崩摧。
洞天石扉，訇然中开。
青冥浩荡不见底，日月照耀金银台。
霓为衣兮风为马，云之君兮纷纷而来下。
虎鼓瑟兮鸾回车，仙之人兮列如麻。
忽魂悸以魄动，恍惊起而长嗟。
惟觉时之枕席，失向来之烟霞。
世间行乐亦如此，古来万事东流水。
别君去兮何时还？且放白鹿青崖间，须行即骑访名山。
安能摧眉折腰事权贵，使我不得开心颜。`;
const english=`Progress grows quietly when you show up every day.
A thoughtful mind makes even ordinary moments meaningful.
Write clearly, think deeply, and keep moving forward.
The smallest step is still a step in the right direction.
Good habits are built through patient repetition.
There is beauty in the way we learn to begin again.
Let curiosity guide you, and let practice strengthen you.
A calm mind can make room for remarkable ideas.
You do not have to rush to make meaningful progress.
Choose the work that matters and give it your attention.`;
const essay=`Learning is not simply a matter of collecting information. It is a process of asking better questions, testing our ideas, and improving through practice.

In daily life, small efforts often matter more than dramatic promises. When we read carefully, write clearly, and reflect on our mistakes, progress becomes a habit rather than an accident.

The purpose of education is not only to prepare for an examination, but also to develop the ability to think independently and act responsibly.`;
export const PRESETS=[
{id:'spring',label:'《春江花月夜》· 张若虚（全文）',lang:'zh',title:'春江花月夜',author:'张若虚 · 唐',mode:'poem',text:spring},
{id:'meng',label:'《梦游天姥吟留别》· 李白（全文）',lang:'zh',title:'梦游天姥吟留别',author:'李白 · 唐',mode:'poem',text:meng},
{id:'quiet',label:'《静夜思》· 李白',lang:'zh',title:'静夜思',author:'李白 · 唐',mode:'poem',text:'床前明月光，疑是地上霜。\n举头望明月，低头思故乡。'},
{id:'cnote',label:'中文日常摘抄 · 原创短句',lang:'zh',title:'日常摘抄',author:'INKFLOW · 原创',mode:'prose',text:'山河远阔，人间烟火。\n把平凡的日子写成自己喜欢的模样。\n慢一点也没关系，真正的成长常常悄无声息。\n晴时读书，雨时听雨。'},
{id:'enquote',label:'English · 原创好句集',lang:'en',title:'Everyday English',author:'INKFLOW · Original Sentences',mode:'quotes',text:english},
{id:'enessay',label:'English · 作文练习范文',lang:'en',title:'Practice & Progress',author:'INKFLOW · Original Essay',mode:'essay',text:essay},
{id:'customzh',label:'自定义中文内容',lang:'zh',title:'我的临摹文字',author:'',mode:'prose',text:'在这里输入你想练习的古诗、歌词、文章或日常句子。'},
{id:'customen',label:'自定义英文内容',lang:'en',title:'My Handwriting Practice',author:'',mode:'essay',text:'Write the words and sentences you want to practice here.'}
];
