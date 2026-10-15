"""Materialize reviewed assertions only. Does not simulate game implementation."""
import json,pathlib
rows=[]
def case(id,setup,trigger,expect,blocked='candidate_not_delivered'):
 rows.append(dict(id=id,setup=setup,trigger=trigger,assertion=expect,status='PENDING',blocked_by=blocked,scopes=['formal','preview']))
case('C3-claim','无 k_3，烧烤摊 sp0 夜游食神','接待后先观察；再点收下','收下前不发卡，收下后恰好一张 k_3；只结算原客人收益')
case('C3-history','无 k_3，specialCustomers 分别 0/1/999','启动、入家、刷新','不得以历史总次数补发 k_3')
case('C3-other','无 k_3，其他店特殊客人','点收下','不发 k_3')
case('C3-repeat','已经拥有 k_3','重复收下事件、再次接待 sp0、刷新','k_3 只有一条；无额外卡奖励/字段；保存不回退')
for time,expected in [('18:59:59',False),('19:00:00',True),('23:59:59',True),('00:00:00',True),('04:59:59',True),('05:00:00',False)]:
 case('C4-'+time,'无 k_4，本地 '+time+'；UTC 与 Asia/Tokyo 分别运行','从经营页进入任意已加入 CEO 家',f'k_4 获得={expected}；依据浏览器本地时间，不依据游戏日重置')
case('C4-not-entry','无 k_4，停在经营页','时钟跨越 19:00，尚未入家','仅跨时刻不代替入家事件；入家后补发')
case('C4-repeat','已有 k_4，夜间','切家、反复入家、刷新后入家','只有一张，旧卡不丢，不重复发放')
case('C8-old','旧档四店都 open 且 emp>=1，无 k_8','首次入家','发 k_8，刷新保留')
case('C8-hire','前三店有员工，第四店已开 emp=0，无 k_8','真实雇员入口雇第四家员工','立即发 k_8，无需先入家；员工费用仍按原规则')
case('C8-next-home','四店已开且各>=1员工，无 k_8','下一次入家','发卡一次')
case('C8-missing','四店逐一 open=false 或 emp=0，其他均满足','入家','每个缺项都不发 k_8；不能只数员工总数')
case('C8-repeat','已有 k_8 或满足旧档已补发','重复入家、再雇人、刷新','不重复插入、不追回旧卡')
case('C-atomic','分别准备三种待发卡事件；注入存储失败或读回不一致','触发真实领取/入家/雇人入口','按既有协调器进入保护或回滚，不出现未持久卡的成功提示；恢复后不重复奖励')
case('C-tabs','两个同源临时页面，一个持有真实写锁','第二页领取/入家，显式接管后再触发','失去写权页不提交；最终恰好一张；原金币/雇员/客人奖励不重复')
case('C-schema','同一份固定 main 原始档，在两版本相同事件序列','三卡发放、八动作、刷新、备份','递归路径无养成38新增字段；既有字段值可变化，记录 main 既有动态字段差异')
case('C-gold','分别缺最后一张条件卡或随机卡，其他七张齐','通过各自真实获得入口集齐','都能解锁金马甲 c_gold 和金厨师帽 h_gold、可穿戴、刷新保留；仅五卡不能解锁')
case('C-production-pool','真实启动并启用当前生产 collectibles 注册','检查池并按各分桶抽取','三条件卡不在最终池，其余五张仍在；超级10%、15抽保底、20万价格保持；普通单件概率随候选实际剩余池均分，不强行固定旧分母')
case('H1-boundaries','仅 k_1，77；家宅31已上线且符合深夜小馆风格门槛','04:59:59/05:00/09:59:59/10:00 入家并运行动作','仅 05:00–09:59 扇炭，其他 CEO 不触发')
case('H1-style','仅 k_1，77，早晨；分别家宅31未上线/风格非深夜小馆','进入家里','第1风格版不能提前触发；上线标志和风格实际 ID 待候选定位')
case('H2-seat','仅 k_2，77；逐个实际可坐家具，以及空房','等待对应动作','有坐具坐下凉茶；无坐具不触发；其他 CEO 不触发')
case('H3-bamboo','仅 k_3，77；分别摆 furn_pearl_tea_mat/furn_pearl_tea_stool/furn_pearl_fan_shade_lamp','进入家并观察熊猫完整路径','熊猫仅77家走，在所摆三类竹家具旁停，不穿墙或卡住')
case('H3-empty','仅 k_3，77无竹家具；其他CEO有竹家具','进入并观察','77家熊猫只走；其他 CEO 家没有此熊猫')
case('H4-night','仅 k_4，各已加入 CEO；19:00/04:59/05:00/18:59','入家，有坐具与空房分别观察','仅夜间大圆月；任意坐具可坐，无坐具站立；日间不误触发')
case('H5-table','仅 k_5，珍珠姐，有实际能吃桌','触发动作','桌边数珍珠；其他CEO不触发')
case('H5-fallback','仅 k_5，珍珠姐，无能吃桌，有坐具','触发动作','坐着数珍珠；全空房如何坐待原稿补充，不臆定')
case('H6-bed','仅 k_6，阿宅，有沙发或床','触发动作','躺看漫画；其他CEO不触发')
case('H6-fallback','仅 k_6，阿宅，无沙发床，有椅子或地毯','触发动作','椅子或地毯坐；空房兜底待补充')
case('H7-joined','仅 k_7，火箭老板已加入','本页面首次入家；离家再进；刷新再进','首次倒数气球；同页再进不重复；刷新可再触发，无每日存档标记')
case('H7-locked','仅 k_7，火箭老板未加入；或其他 CEO','入家/查看锁定入口','不触发火箭倒数气球')
case('H8-dusk','仅 k_8，不拥有其他7卡，各已加入CEO','16:59:59/17:00/18:59:59/19:00 入家','仅17:00–18:59四窗亮；不要求八卡齐，不重新要求四店员工门槛')
case('H-absent','逐张移除 k_1..k_8，其他触发前置满足','触发对应动作','没有卡就没有对应变化；旧藏卡即使不满足新获得条件仍能按动作规则展示')
case('H-copy-cooldown','各动作两句全文待补，控制本地时间和动作时间','反复触发；同句间隔599999/600000ms','两句轮换，同句10分钟内不重复；达到边界可再次出现；刷新是否重置待明确','candidate_and_exact_copy')
case('H-no-income','同输入同时间跨度，排除正常挂机收益','分别开关八种动作','动作不改收益倍率、不额外加币/经验；与 main 对照而非简单要求余额不变')
case('H-visual','八动作和三卡提示，320/375/390/430/768','Chromium和已有WebKit，切家/切模式/后台返回','无溢出遮挡，动作与摆放一致，旧重看和输入焦点保留；WebKit无可执行文件则明确未覆盖')
case('H-concurrent','拥有多卡，触发时间/家具同时满足','观察同场景多个动作','优先级和并存按补充原稿验收，不猜测','candidate_and_priority_spec')
for row in rows:
 if row['id'].startswith(('C3-','C4-','C8-')):
  row['copy_expectations']='expected-copy.json；候选图鉴提示及成功获得toast逐字匹配，未执行'
p=pathlib.Path(__file__).resolve().parent
(p/'scenarios.json').write_text(json.dumps({'revision':'confirmed-2026-10-15','condition_card_ids':['k_3','k_4','k_8'],'random_card_ids':['k_1','k_2','k_5','k_6','k_7'],'cases':rows},ensure_ascii=False,indent=2))
print(len(rows),'pending assertions written')
