// Generated verbatim-data mirror of catalog/cards.json; verify with tests/catalog.test.mjs.
export default {
  "catalogVersion": "bk-cards-static-v2",
  "runtimeSchema": {
    "file": "card-definition.schema.json",
    "id": "urn:bookstore:cardcore:card-definition:0.1.0",
    "sha256": "5d34012e0c965858580046cb397ed12b9a343fbb31e540001742c5481b803b8e"
  },
  "source": {
    "file": "source-art-v1.csv",
    "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
    "rows": 83
  },
  "primitives": [
    "vanilla_minion",
    "plain_weapon",
    "damage_single",
    "heal_single",
    "draw",
    "temp_mana",
    "random_damage_once"
  ],
  "cards": [
    {
      "id": "bk-van-cs2-108",
      "sourceId": "VAN_CS2_108",
      "sourceRow": 2,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 2,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：消灭一个受伤的敌方随从。"
      },
      "sourceEffectText": "消灭一个受伤的敌方随从。",
      "effects": [
        {
          "clause": "消灭一个受伤的敌方随从。",
          "mechanisms": [
            "destroy",
            "condition_damaged"
          ]
        }
      ],
      "requiredMechanisms": [
        "destroy",
        "condition_damaged"
      ],
      "name": "退场签",
      "nameStatus": "candidate",
      "artBrief": "77把一枚红色退场纸签夹在已经破损的对侧纸偶胸前。近景聚焦破损痕迹与合拢的烤夹，背景其余角色清晰完整。",
      "artSemantics": "历史参考费用 1。源效果：消灭一个受伤的敌方随从。\n画面语义：必须画出目标已受伤且属于敌方，不表现满血直接消灭或全场清除。",
      "forbiddenRefs": "不使用原卡处决人物、暴雪种族轮廓或原构图。避开血腥斩首意象。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：destroy、condition_damaged",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-400",
      "sourceId": "VAN_EX1_400",
      "sourceRow": 3,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 3,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：对所有随从造成1点伤害。"
      },
      "sourceEffectText": "对所有随从造成1点伤害。",
      "effects": [
        {
          "clause": "对所有随从造成1点伤害。",
          "mechanisms": [
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "aoe"
      ],
      "name": "后厨大扫场",
      "nameStatus": "candidate",
      "artBrief": "77转动大扫帚，纸屑圆环扫过柜台两侧的小型角色。双方随从都处在同一冲击圈，英雄站在圈外。",
      "artSemantics": "历史参考费用 1。源效果：对所有随从造成1点伤害。\n画面语义：范围包含双方全部随从，不含英雄。圆环只表达一次范围伤害。",
      "forbiddenRefs": "不借用原卡旋转战士、战斧剪影或血色风暴构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-114",
      "sourceId": "VAN_CS2_114",
      "sourceRow": 4,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 2,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 4,
        "column": "必保留语义",
        "text": "历史参考费用 2。源效果：随机对两个敌方随从造成 2点伤害。"
      },
      "sourceEffectText": "随机对两个敌方随从造成 2点伤害。",
      "effects": [
        {
          "clause": "随机对两个敌方随从造成 2点伤害。",
          "mechanisms": [
            "random_multi"
          ]
        }
      ],
      "requiredMechanisms": [
        "random_multi"
      ],
      "name": "双份急单",
      "nameStatus": "candidate",
      "artBrief": "两张红色急单沿不规则折线飞向对侧两名不同角色，柜台前方的77只是发令者。两个落点同等醒目，路径不画成玩家选定的准星。",
      "artSemantics": "历史参考费用 2。源效果：随机对两个敌方随从造成 2点伤害。\n画面语义：随机两个不同敌方随从，不能画成一名目标连续两次或伤及英雄。",
      "forbiddenRefs": "不借用原卡武器横劈姿态、原角色或原场景。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：random_multi",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-105",
      "sourceId": "VAN_CS2_105",
      "sourceRow": 5,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 2,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 5,
        "column": "必保留语义",
        "text": "历史参考费用 2。源效果：在本回合中，使你的英雄获得+4攻击力。"
      },
      "sourceEffectText": "在本回合中，使你的英雄获得+4攻击力。",
      "effects": [
        {
          "clause": "在本回合中，使你的英雄获得+4攻击力。",
          "mechanisms": [
            "hero_attack_temp",
            "buff"
          ]
        }
      ],
      "requiredMechanisms": [
        "hero_attack_temp",
        "buff"
      ],
      "name": "掌勺上阵",
      "nameStatus": "candidate",
      "artBrief": "77卷起袖子握紧熟悉的烤夹，人物占画面三分之二，身后出现短促红色力量线与一页将翻过的日历。",
      "artSemantics": "历史参考费用 2。源效果：在本回合中，使你的英雄获得+4攻击力。\n画面语义：强化的是己方英雄，持续仅本回合。不能画成永久增益、随从增益或额外攻击次数。",
      "forbiddenRefs": "不使用原英雄、剑击造型或原卡战斗场面。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：hero_attack_temp、buff",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-106",
      "sourceId": "VAN_CS2_106",
      "sourceRow": 6,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "weapon",
      "typeLabel": "武器",
      "tribe": null,
      "cost": 2,
      "attack": 3,
      "health": null,
      "durability": 2,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 6,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考攻击 3，耐久 2。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "plain_weapon"
          ]
        }
      ],
      "requiredMechanisms": [
        "plain_weapon"
      ],
      "name": "红柄炭火夹",
      "nameStatus": "candidate",
      "artBrief": "一把原创红木柄不锈钢烤夹斜放在暖纸上，钳口宽大、铆钉清楚，旁有炭火反光但器具本身没有魔法火焰。保留轮廓和耐用感。",
      "artSemantics": "历史参考费用 2。参考攻击 3，耐久 2。源效果：（无效果）\n画面语义：无附加效果武器。炭火仅是背景，不表示燃烧、持续伤害或范围伤害。",
      "forbiddenRefs": "不画战斧、不沿用原卡斧刃几何、符文、配色布局或火焰武器构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2106",
        "name": "红柄炭火夹",
        "type": "weapon",
        "cost": 2,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 3,
        "durability": 2
      },
      "expected": {
        "afterPlay": {
          "heroAttack": 3,
          "durability": 2,
          "manaSpent": 2
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-084",
      "sourceId": "VAN_EX1_084",
      "sourceRow": 7,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 2,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 7,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 2/3。源效果：每当你召唤一个攻击力小于或等于3的随从，使其获得冲锋。"
      },
      "sourceEffectText": "每当你召唤一个攻击力小于或等于3的随从，使其获得冲锋。",
      "effects": [
        {
          "clause": "每当你召唤一个攻击力小于或等于3的随从，使其获得冲锋。",
          "mechanisms": [
            "keyword_charge",
            "summon",
            "trigger"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge",
        "summon",
        "trigger"
      ],
      "name": "开摊领班",
      "nameStatus": "candidate",
      "artBrief": "原创成年领班戴素色头巾举起订单板，身后刚到场的轻装伙伴沿柜台通道起跑。主体是指挥者，伙伴只作简化陪衬。",
      "artSemantics": "历史参考费用 3。参考身材 2/3。源效果：每当你召唤一个攻击力小于或等于3的随从，使其获得冲锋。\n画面语义：持续触发只对应新召唤且攻击力不超过3的随从；不画成全体或已在场随从永久加速。",
      "forbiddenRefs": "不借用原战歌人物、兽人外形、部族旗帜、肩甲或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge、summon、trigger",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-103",
      "sourceId": "VAN_CS2_103",
      "sourceRow": 8,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 3,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 8,
        "column": "必保留语义",
        "text": "历史参考费用 3。源效果：使一个友方随从获得+2攻击力和冲锋。"
      },
      "sourceEffectText": "使一个友方随从获得+2攻击力和冲锋。",
      "effects": [
        {
          "clause": "使一个友方随从获得+2攻击力和冲锋。",
          "mechanisms": [
            "keyword_charge",
            "buff",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge",
        "buff",
        "target_filter_minion"
      ],
      "name": "打烊冲刺",
      "nameStatus": "candidate",
      "artBrief": "77把红色加急围巾递给一名友方送餐员，送餐员刚跨出柜台便向前冲。只有这一个伙伴获得明确的红色动势光。",
      "artSemantics": "历史参考费用 3。源效果：使一个友方随从获得+2攻击力和冲锋。\n画面语义：一个友方随从获得攻击力增益与冲锋。不要擅自附加只能攻击随从的限制。",
      "forbiddenRefs": "不借用原卡冲锋骑手、武器姿态、坐骑或原图速度线布置。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge、buff、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-606",
      "sourceId": "VAN_EX1_606",
      "sourceRow": 9,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 3,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 9,
        "column": "必保留语义",
        "text": "历史参考费用 3。源效果：获得5点护甲值。抽一张牌。"
      },
      "sourceEffectText": "获得5点护甲值。抽一张牌。",
      "effects": [
        {
          "clause": "获得5点护甲值。",
          "mechanisms": [
            "armor"
          ]
        },
        {
          "clause": "抽一张牌。",
          "mechanisms": [
            "draw"
          ]
        }
      ],
      "requiredMechanisms": [
        "armor",
        "draw",
        "multi_effect"
      ],
      "name": "厚垫备餐",
      "nameStatus": "candidate",
      "artBrief": "77在胸前垫起一摞方形隔热垫，另一只手从小票夹抽出一张全新的空白订单卡。两件动作分处左右，先防护再补牌的阅读顺序清楚。",
      "artSemantics": "历史参考费用 3。源效果：获得5点护甲值。抽一张牌。\n画面语义：护甲属于英雄且与抽一张牌同时列明；画面不能把护甲当作回复生命或圣盾。",
      "forbiddenRefs": "不借用原盾牌外形、纹章、战士手部姿态或原构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：armor、multi_effect（原型 CardDefinition 每张卡只有一个 effect，复合效果不能拆成单效果，源效果各子句完整保留）",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-new1-011",
      "sourceId": "VAN_NEW1_011",
      "sourceRow": 10,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 4,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 10,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 4/3。源效果：冲锋"
      },
      "sourceEffectText": "冲锋",
      "effects": [
        {
          "clause": "冲锋",
          "mechanisms": [
            "keyword_charge"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge"
      ],
      "name": "街口快送员",
      "nameStatus": "candidate",
      "artBrief": "原创成年骑行送餐员身背方形保温箱，单脚刚落地就拎起纸袋冲向店门。低机位三分之二侧身，红色围巾形成单一速度方向。",
      "artSemantics": "历史参考费用 4。参考身材 4/3。源效果：冲锋\n画面语义：随从身份与冲锋，不能让画面暗示召唤时直接造成额外伤害。",
      "forbiddenRefs": "不借用库卡隆人物、兽人外形、战斧、部族标记或原动作构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-112",
      "sourceId": "VAN_CS2_112",
      "sourceRow": 11,
      "class": "warrior",
      "classLabel": "战士（77）",
      "hero": "c77",
      "type": "weapon",
      "typeLabel": "武器",
      "tribe": null,
      "cost": 5,
      "attack": 5,
      "health": null,
      "durability": 2,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 11,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考攻击 5，耐久 2。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "plain_weapon"
          ]
        }
      ],
      "requiredMechanisms": [
        "plain_weapon"
      ],
      "name": "加长铁板铲",
      "nameStatus": "candidate",
      "artBrief": "一把宽阔厚重的长柄铁板铲靠在料理台边，铲面压出独特的斜角轮廓，背景小器具用于衬托重量。以金属高光体现高攻击。",
      "artSemantics": "历史参考费用 5。参考攻击 5，耐久 2。源效果：（无效果）\n画面语义：无附加效果武器，不能添加破甲、顺劈或击杀收益等暗示。",
      "forbiddenRefs": "不画双刃斧，不借用奥金材质设定、原武器轮廓、符文或原构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2112",
        "name": "加长铁板铲",
        "type": "weapon",
        "cost": 5,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 5,
        "durability": 2
      },
      "expected": {
        "afterPlay": {
          "heroAttack": 5,
          "durability": 2,
          "manaSpent": 5
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-277",
      "sourceId": "VAN_EX1_277",
      "sourceRow": 12,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 12,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：造成3点伤害，随机分配到所有敌方角色身上。"
      },
      "sourceEffectText": "造成3点伤害，随机分配到所有敌方角色身上。",
      "effects": [
        {
          "clause": "造成3点伤害，随机分配到所有敌方角色身上。",
          "mechanisms": [
            "random_multi"
          ]
        }
      ],
      "requiredMechanisms": [
        "random_multi"
      ],
      "name": "飞页乱弹",
      "nameStatus": "candidate",
      "artBrief": "阿宅从书中放出三枚折纸光点，三条轻巧曲线奔向对侧人物群。落点有高低差，避免像可逐个锁定的瞄准界面。",
      "artSemantics": "历史参考费用 1。源效果：造成3点伤害，随机分配到所有敌方角色身上。\n画面语义：总伤害随机分配给敌方角色，可包含英雄；纸片不代表抽牌或弃牌。",
      "forbiddenRefs": "不使用原奥术飞弹色形组合、施法者、符文和原卡构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：random_multi",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-027",
      "sourceId": "VAN_CS2_027",
      "sourceRow": 13,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 13,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：召唤两个0/2，并具有嘲讽的随从。"
      },
      "sourceEffectText": "召唤两个0/2，并具有嘲讽的随从。",
      "effects": [
        {
          "clause": "召唤两个0/2，并具有嘲讽的随从。",
          "mechanisms": [
            "keyword_taunt",
            "summon"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt",
        "summon"
      ],
      "name": "纸页替身",
      "nameStatus": "candidate",
      "artBrief": "阿宅站在后方，两名由折叠书页拼成的原创纸偶并排挡在前景。纸偶轮廓不同于阿宅本人，双臂像展开的隔板，表情安静。",
      "artSemantics": "历史参考费用 1。源效果：召唤两个0/2，并具有嘲讽的随从。\n画面语义：召唤恰好两个0/2嘲讽随从。衍生物需另列素材，不把英雄复制或镜像攻击作为新机制。",
      "forbiddenRefs": "不借用原镜像人物、袍服、头饰、蓝色投影形态或原场景。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt、summon",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-025",
      "sourceId": "VAN_CS2_025",
      "sourceRow": 14,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 2,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 14,
        "column": "必保留语义",
        "text": "历史参考费用 2。源效果：对所有敌方随从造成1点伤害。"
      },
      "sourceEffectText": "对所有敌方随从造成1点伤害。",
      "effects": [
        {
          "clause": "对所有敌方随从造成1点伤害。",
          "mechanisms": [
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "aoe"
      ],
      "name": "书架震页",
      "nameStatus": "candidate",
      "artBrief": "书架前一圈靛蓝纸页波纹向对面低矮展台展开，敌方随从身旁出现小冲击点，双方英雄不在波纹高度内。",
      "artSemantics": "历史参考费用 2。源效果：对所有敌方随从造成1点伤害。\n画面语义：一次伤害覆盖所有敌方随从，不含己方和英雄。",
      "forbiddenRefs": "不借用原法师、奥术符文、魔爆光球或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-024",
      "sourceId": "VAN_CS2_024",
      "sourceRow": 15,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 2,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 15,
        "column": "必保留语义",
        "text": "历史参考费用 2。源效果：对一个角色造成3点伤害，并使其冻结。"
      },
      "sourceEffectText": "对一个角色造成3点伤害，并使其冻结。",
      "effects": [
        {
          "clause": "对一个角色造成3点伤害，并使其冻结。",
          "mechanisms": [
            "freeze",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "freeze",
        "damage_single"
      ],
      "name": "冷藏书签",
      "nameStatus": "candidate",
      "artBrief": "阿宅弹出一枚带霜的蓝色长书签，命中单个纸偶后，书签尖端的短促撞击光与目标脚边冻结纹分开呈现。主体和目标之间留白。",
      "artSemantics": "历史参考费用 2。源效果：对一个角色造成3点伤害，并使其冻结。\n画面语义：一个角色受到伤害并被冻结，不能将可选目标缩成仅随从；插画不规定冻结解除时点。",
      "forbiddenRefs": "不使用原冰箭形状、施法手势、法师角色或原配色构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：freeze",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-023",
      "sourceId": "VAN_CS2_023",
      "sourceRow": 16,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 3,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 16,
        "column": "必保留语义",
        "text": "历史参考费用 3。源效果：抽两张牌。"
      },
      "sourceEffectText": "抽两张牌。",
      "effects": [
        {
          "clause": "抽两张牌。",
          "mechanisms": [
            "draw"
          ]
        }
      ],
      "requiredMechanisms": [
        "draw"
      ],
      "name": "夜读笔记",
      "nameStatus": "candidate",
      "artBrief": "阿宅坐在柔暖台灯下，从一本深蓝笔记本中抽出两张空白索引卡。眼镜、卷发和帽衫保留，两张卡都完整可数。",
      "artSemantics": "历史参考费用 3。源效果：抽两张牌。\n画面语义：抽两张牌，不表现发现、三选一、复制或额外费用增长。",
      "forbiddenRefs": "不借用原奥术书本封面、法师肖像、光环或原构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2023",
        "name": "夜读笔记",
        "type": "spell",
        "cost": 3,
        "text": "抽2张牌。",
        "art": "placeholder",
        "effect": {
          "kind": "draw",
          "n": 2,
          "target": "none"
        }
      },
      "expected": {
        "handDelta": 2,
        "manaSpent": 3
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-026",
      "sourceId": "VAN_CS2_026",
      "sourceRow": 17,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 3,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 17,
        "column": "必保留语义",
        "text": "历史参考费用 3。源效果：冻结所有敌方随从。"
      },
      "sourceEffectText": "冻结所有敌方随从。",
      "effects": [
        {
          "clause": "冻结所有敌方随从。",
          "mechanisms": [
            "freeze",
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "freeze",
        "aoe"
      ],
      "name": "定格一页",
      "nameStatus": "candidate",
      "artBrief": "阿宅翻到一张透明覆膜大书页，冷雾沿对侧地板铺开，把全部敌方随从的影子暂时定住。没有爆裂或受伤姿势。",
      "artSemantics": "历史参考费用 3。源效果：冻结所有敌方随从。\n画面语义：冻结所有敌方随从而不造成伤害，不含英雄；不自行定义解冻回合。",
      "forbiddenRefs": "不借用原冰霜新星放射纹、法师剪影、雪景或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：freeze、aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-033",
      "sourceId": "VAN_CS2_033",
      "sourceRow": 18,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 3,
      "health": 6,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 18,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 3/6。源效果：冻结任何受到本随从伤害的角色。"
      },
      "sourceEffectText": "冻结任何受到本随从伤害的角色。",
      "effects": [
        {
          "clause": "冻结任何受到本随从伤害的角色。",
          "mechanisms": [
            "freeze",
            "trigger"
          ]
        }
      ],
      "requiredMechanisms": [
        "freeze",
        "trigger"
      ],
      "name": "冷雾装订灵",
      "nameStatus": "candidate",
      "artBrief": "原创装订纸灵由透明覆膜、卷纸和冷雾组成，身体像折叠的书页柱，细长纸臂前伸，触碰处留下霜线。轮廓清爽，蓝色书签是识别点。",
      "artSemantics": "历史参考费用 4。参考身材 3/6。源效果：冻结任何受到本随从伤害的角色。\n画面语义：随从造成伤害才冻结受伤角色，不表现登场就冻结、全场冻结或免疫。源表未列种族，不补加新种族规则。",
      "forbiddenRefs": "不使用原水元素的体型、面部、液态手臂、漩涡构图或原角色。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：freeze、trigger",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-029",
      "sourceId": "VAN_CS2_029",
      "sourceRow": 19,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 4,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 19,
        "column": "必保留语义",
        "text": "历史参考费用 4。源效果：造成6点伤害。"
      },
      "sourceEffectText": "造成6点伤害。",
      "effects": [
        {
          "clause": "造成6点伤害。",
          "mechanisms": [
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "damage_single"
      ],
      "name": "落款热印",
      "nameStatus": "candidate",
      "artBrief": "阿宅将一枚圆方结合的原创封面压印章拍下，靛蓝墨线中迸出单次橙色热印冲击。画面聚焦印章和一个留白目标位。",
      "artSemantics": "历史参考费用 4。源效果：造成6点伤害。\n画面语义：单次直接伤害，可作用的目标按源语义保留，不增加持续燃烧或范围效果。",
      "forbiddenRefs": "不借用原火球造型、施法手势、火焰脸孔或原构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2029",
        "name": "落款热印",
        "type": "spell",
        "cost": 4,
        "text": "造成6点伤害。",
        "art": "placeholder",
        "effect": {
          "kind": "damage",
          "n": 6,
          "target": "any"
        }
      },
      "expected": {
        "targetHealthDelta": -6,
        "manaSpent": 4
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-022",
      "sourceId": "VAN_CS2_022",
      "sourceRow": 20,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 4,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 20,
        "column": "必保留语义",
        "text": "历史参考费用 4。源效果：使一个随从变形成为1/1的绵羊。"
      },
      "sourceEffectText": "使一个随从变形成为1/1的绵羊。",
      "effects": [
        {
          "clause": "使一个随从变形成为1/1的绵羊。",
          "mechanisms": [
            "transform",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "transform",
        "target_filter_minion"
      ],
      "name": "绒绒校样",
      "nameStatus": "candidate",
      "artBrief": "阿宅用软毛刷划过一个人物剪影，剪影另一侧变成原创奶白绒面小羊。书页翻转边界表现前后变化，小羊为唯一结果对象。",
      "artSemantics": "历史参考费用 4。源效果：使一个随从变形成为1/1的绵羊。\n画面语义：一个随从变为1/1绵羊；小羊仍需保留绵羊衍生物语义，不改成随机动物、沉默或暂时缩小。",
      "forbiddenRefs": "不借用原卡绵羊外形、蓝色变形烟雾、施法角色或原构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：transform、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-032",
      "sourceId": "VAN_CS2_032",
      "sourceRow": 21,
      "class": "mage",
      "classLabel": "法师（阿宅）",
      "hero": "otaku",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 7,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 21,
        "column": "必保留语义",
        "text": "历史参考费用 7。源效果：对所有敌方随从造成4点伤害。"
      },
      "sourceEffectText": "对所有敌方随从造成4点伤害。",
      "effects": [
        {
          "clause": "对所有敌方随从造成4点伤害。",
          "mechanisms": [
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "aoe"
      ],
      "name": "闭馆热浪",
      "nameStatus": "candidate",
      "artBrief": "高处阅读灯照亮一排翻起的橙色书页，热浪从书架上方落向对侧全部随从。己方区域用平静靛蓝阴影分隔，避免火海遮挡人物。",
      "artSemantics": "历史参考费用 7。源效果：对所有敌方随从造成4点伤害。\n画面语义：所有敌方随从受到一次范围伤害，不含英雄或己方，不添加持续火地。",
      "forbiddenRefs": "不借用原烈焰风暴图的火柱、战场、角色、构图或魔法纹路。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-087",
      "sourceId": "VAN_CS2_087",
      "sourceRow": 22,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 22,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：使一个随从获得+3攻击力。"
      },
      "sourceEffectText": "使一个随从获得+3攻击力。",
      "effects": [
        {
          "clause": "使一个随从获得+3攻击力。",
          "mechanisms": [
            "buff",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "buff",
        "target_filter_minion"
      ],
      "name": "加油茶签",
      "nameStatus": "candidate",
      "artBrief": "珍珠姐把一张金边加油茶签别到单名伙伴的杯套上，伙伴握拳微笑，绿色背景中只有受助者浮现暖金力量线。",
      "artSemantics": "历史参考费用 1。源效果：使一个随从获得+3攻击力。\n画面语义：单个随从获得攻击力增益，不附加生命值、英雄强化或治疗。",
      "forbiddenRefs": "不借用原祝福手势、圣光纹章、人物盔甲或原构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：buff、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-371",
      "sourceId": "VAN_EX1_371",
      "sourceRow": 23,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 23,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：使一个随从获得圣盾。"
      },
      "sourceEffectText": "使一个随从获得圣盾。",
      "effects": [
        {
          "clause": "使一个随从获得圣盾。",
          "mechanisms": [
            "keyword_divine_shield",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_divine_shield",
        "target_filter_minion"
      ],
      "name": "珍珠护套",
      "nameStatus": "candidate",
      "artBrief": "珍珠姐递出一枚透明圆润杯套，杯套放大成罩住单名伙伴的薄金光壳。壳表面只有一处将被碰裂的高光，人物仍清楚可见。",
      "artSemantics": "历史参考费用 1。源效果：使一个随从获得圣盾。\n画面语义：单个随从获得圣盾。表现一次性防护壳，不将其画成护甲、加血、嘲讽或永久无敌。",
      "forbiddenRefs": "不借用原卡圣光手掌、盔甲、符号或保护之手构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_divine_shield、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-360",
      "sourceId": "VAN_EX1_360",
      "sourceRow": 24,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 24,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：使一个随从的攻击力变为1。"
      },
      "sourceEffectText": "使一个随从的攻击力变为1。",
      "effects": [
        {
          "clause": "使一个随从的攻击力变为1。",
          "mechanisms": [
            "set_attack",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "set_attack",
        "target_filter_minion"
      ],
      "name": "收声书夹",
      "nameStatus": "candidate",
      "artBrief": "一枚小巧绿色书夹夹住夸张的大喇叭纸页，使它收拢成细小开口。珍珠姐在边缘做轻柔提醒动作，目标仍保持原有身体大小。",
      "artSemantics": "历史参考费用 1。源效果：使一个随从的攻击力变为1。\n画面语义：将一个随从攻击力设为1；不表示沉默、冻结、失去所有能力或生命值改变。",
      "forbiddenRefs": "不借用原卡跪姿人物、圣骑士服饰、圣光图形或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：set_attack、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-091",
      "sourceId": "VAN_CS2_091",
      "sourceRow": 25,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "weapon",
      "typeLabel": "武器",
      "tribe": null,
      "cost": 1,
      "attack": 1,
      "health": null,
      "durability": 4,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 25,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考攻击 1，耐久 4。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "plain_weapon"
          ]
        }
      ],
      "requiredMechanisms": [
        "plain_weapon"
      ],
      "name": "黄铜搅拌匙",
      "nameStatus": "candidate",
      "artBrief": "细长黄铜搅拌匙立在浅绿色杯垫上，末端镶一颗圆润白珠，握柄磨痕体现耐用。主体采用干净侧视轮廓。",
      "artSemantics": "历史参考费用 1。参考攻击 1，耐久 4。源效果：（无效果）\n画面语义：无附加效果武器；珍珠装饰不表示回复、圣盾或召唤。",
      "forbiddenRefs": "不画原卡锤头和圣光纹章，不沿用原武器轮廓、符文或构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2091",
        "name": "黄铜搅拌匙",
        "type": "weapon",
        "cost": 1,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 1,
        "durability": 4
      },
      "expected": {
        "afterPlay": {
          "heroAttack": 1,
          "durability": 4,
          "manaSpent": 1
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-089",
      "sourceId": "VAN_CS2_089",
      "sourceRow": 26,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 2,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 26,
        "column": "必保留语义",
        "text": "历史参考费用 2。源效果：恢复6点生命值。"
      },
      "sourceEffectText": "恢复6点生命值。",
      "effects": [
        {
          "clause": "恢复6点生命值。",
          "mechanisms": [
            "heal_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "heal_single"
      ],
      "name": "温杯小憩",
      "nameStatus": "candidate",
      "artBrief": "珍珠姐把一杯温茶推向留白中的受伤角色，杯口蒸汽汇成柔和修复弧线。画面保留目标可变空间，不限定为英雄肖像。",
      "artSemantics": "历史参考费用 2。源效果：恢复6点生命值。\n画面语义：恢复生命，不变成护甲；不得套用采集时Legacy版本的仅己方英雄限制或数值。",
      "forbiddenRefs": "不借用原治疗人物、圣光教会符号、手掌布局或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2089",
        "name": "温杯小憩",
        "type": "spell",
        "cost": 2,
        "text": "恢复6点生命值。",
        "art": "placeholder",
        "effect": {
          "kind": "heal",
          "n": 6,
          "target": "any"
        }
      },
      "expected": {
        "targetHealthDelta": "+min(6, 已损失生命)",
        "manaSpent": 2
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-092",
      "sourceId": "VAN_CS2_092",
      "sourceRow": 27,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 4,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 27,
        "column": "必保留语义",
        "text": "历史参考费用 4。源效果：使一个随从获得+4/+4。（+4攻击力/+4生命值）"
      },
      "sourceEffectText": "使一个随从获得+4/+4。（+4攻击力/+4生命值）",
      "effects": [
        {
          "clause": "使一个随从获得+4/+4。（+4攻击力/+4生命值）",
          "mechanisms": [
            "buff",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "buff",
        "target_filter_minion"
      ],
      "name": "四方赠礼",
      "nameStatus": "candidate",
      "artBrief": "珍珠姐为单名伙伴系上方形茶礼包，礼包展开两条互补色带：一条环住拳头、一条护住身形。背景其他角色保持素色。",
      "artSemantics": "历史参考费用 4。源效果：使一个随从获得+4/+4。（+4攻击力/+4生命值）\n画面语义：一个随从同时获得攻击与生命增益；色带只表达两种属性，不引入两次触发或全体强化。",
      "forbiddenRefs": "不借用原王冠、王者铠甲、圣骑士纹章、光束或构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：buff、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-093",
      "sourceId": "VAN_CS2_093",
      "sourceRow": 28,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 4,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 28,
        "column": "必保留语义",
        "text": "历史参考费用 4。源效果：对所有敌人造成2点伤害。"
      },
      "sourceEffectText": "对所有敌人造成2点伤害。",
      "effects": [
        {
          "clause": "对所有敌人造成2点伤害。",
          "mechanisms": [
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "aoe"
      ],
      "name": "满场送茶",
      "nameStatus": "candidate",
      "artBrief": "珍珠姐摆开的圆形托盘激起一圈金色茶香纸纹，波纹越过对側全部随从并延伸到敌方英雄位置。己方角色位于托盘内侧静区。",
      "artSemantics": "历史参考费用 4。源效果：对所有敌人造成2点伤害。\n画面语义：伤害覆盖所有敌人，包含敌方英雄；不是为全场治疗，也不是双方都受伤。",
      "forbiddenRefs": "不借用原圣地、教堂、圣光法阵、角色与原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-094",
      "sourceId": "VAN_CS2_094",
      "sourceRow": 29,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 4,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 29,
        "column": "必保留语义",
        "text": "历史参考费用 4。源效果：造成3点伤害。抽一张牌。"
      },
      "sourceEffectText": "造成3点伤害。抽一张牌。",
      "effects": [
        {
          "clause": "造成3点伤害。",
          "mechanisms": [
            "damage_single"
          ]
        },
        {
          "clause": "抽一张牌。",
          "mechanisms": [
            "draw"
          ]
        }
      ],
      "requiredMechanisms": [
        "damage_single",
        "draw",
        "multi_effect"
      ],
      "name": "落签回执",
      "nameStatus": "candidate",
      "artBrief": "珍珠姐将一枚厚实茶店印签投向单个目标，碰撞小光点旁，一张新的回执卡从收据夹滑出。撞击和补牌动作各占半边。",
      "artSemantics": "历史参考费用 4。源效果：造成3点伤害。抽一张牌。\n画面语义：直接伤害后抽一张牌；印签不是可装备武器，不附加眩晕或冻结。",
      "forbiddenRefs": "不借用原飞锤、符文锤头、盔甲手臂或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：multi_effect（原型 CardDefinition 每张卡只有一个 effect，复合效果不能拆成单效果，源效果各子句完整保留）",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-097",
      "sourceId": "VAN_CS2_097",
      "sourceRow": 30,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "weapon",
      "typeLabel": "武器",
      "tribe": null,
      "cost": 4,
      "attack": 4,
      "health": null,
      "durability": 2,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 30,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考攻击 4，耐久 2。源效果：每当你的英雄进攻，便为其恢复2点生命值。"
      },
      "sourceEffectText": "每当你的英雄进攻，便为其恢复2点生命值。",
      "effects": [
        {
          "clause": "每当你的英雄进攻，便为其恢复2点生命值。",
          "mechanisms": [
            "trigger",
            "heal_fixed_target"
          ]
        }
      ],
      "requiredMechanisms": [
        "trigger",
        "heal_fixed_target"
      ],
      "name": "回甘长柄勺",
      "nameStatus": "candidate",
      "artBrief": "一把原创银色长柄调茶勺斜贯画面，柄端系绿色布结。使用它的珍珠姐位于背景，攻击方向向外，暖金回流弧线回到她身上。",
      "artSemantics": "历史参考费用 4。参考攻击 4，耐久 2。源效果：每当你的英雄进攻，便为其恢复2点生命值。\n画面语义：武器对应英雄每次进攻时回复英雄生命；不是给命中对象治疗、通用吸血或仅击杀触发。",
      "forbiddenRefs": "不画剑刃，不沿用真银圣剑造型、圣光纹章、符文或原卡构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：trigger、heal_fixed_target",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-088",
      "sourceId": "VAN_CS2_088",
      "sourceRow": 31,
      "class": "paladin",
      "classLabel": "圣骑士（珍珠姐）",
      "hero": "pearl",
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 7,
      "attack": 5,
      "health": 6,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 31,
        "column": "必保留语义",
        "text": "历史参考费用 7。参考身材 5/6。源效果：战吼：为你的英雄恢复6点生命值。"
      },
      "sourceEffectText": "战吼：为你的英雄恢复6点生命值。",
      "effects": [
        {
          "clause": "战吼：为你的英雄恢复6点生命值。",
          "mechanisms": [
            "battlecry",
            "heal_fixed_target"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "heal_fixed_target"
      ],
      "name": "夜班茶馆管事",
      "nameStatus": "candidate",
      "artBrief": "原创成年女管事推开夜间茶馆门，穿宽松绿色外套，提着保温茶壶向画外英雄送去暖光。人物体格稳健，与珍珠姐的发型服饰明确区分。",
      "artSemantics": "历史参考费用 7。参考身材 5/6。源效果：战吼：为你的英雄恢复6点生命值。\n画面语义：登场战吼回复己方英雄生命；源Classic记录没有嘲讽，不画盾牌或挡路姿态暗示嘲讽。",
      "forbiddenRefs": "不借用列王守卫身份、盔甲、长须、武器、王室纹章或原构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、heal_fixed_target",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-new1-003",
      "sourceId": "VAN_NEW1_003",
      "sourceRow": 32,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 0,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 32,
        "column": "必保留语义",
        "text": "历史参考费用 0。源效果：消灭一个恶魔，为你的英雄恢复5点生命值。"
      },
      "sourceEffectText": "消灭一个恶魔，为你的英雄恢复5点生命值。",
      "effects": [
        {
          "clause": "消灭一个恶魔，为你的英雄恢复5点生命值。",
          "mechanisms": [
            "destroy",
            "target_filter_tribe",
            "heal_fixed_target"
          ]
        }
      ],
      "requiredMechanisms": [
        "destroy",
        "target_filter_tribe",
        "heal_fixed_target"
      ],
      "name": "墨契回收",
      "nameStatus": "candidate",
      "artBrief": "火箭将一枚紫色契约印收回笔记本，一只原创契约纸偶化成可回收墨点，墨点汇成暖色回流弧线返回火箭。用两侧留白避免锁死归属。",
      "artSemantics": "历史参考费用 0。源效果：消灭一个恶魔，为你的英雄恢复5点生命值。\n画面语义：目标必须是恶魔且源Classic可涉及任一方恶魔，再回复己方英雄。原创契约纸偶与恶魔标签的映射待设计决定，不缩成仅友方。",
      "forbiddenRefs": "不借用原恶魔、邪能符号、献祭法阵、血腥造型或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：destroy、target_filter_tribe、heal_fixed_target",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-308",
      "sourceId": "VAN_EX1_308",
      "sourceRow": 33,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 0,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 33,
        "column": "必保留语义",
        "text": "历史参考费用 0。源效果：造成4点伤害，随机弃一 张牌。"
      },
      "sourceEffectText": "造成4点伤害，随机弃一 张牌。",
      "effects": [
        {
          "clause": "造成4点伤害，随机弃一 张牌。",
          "mechanisms": [
            "discard_random",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "discard_random",
        "damage_single"
      ],
      "name": "废稿点火",
      "nameStatus": "candidate",
      "artBrief": "火箭从墨紫笔记本中发出一道橙色纸火冲击，同时侧边一张背面朝外的手牌落入废纸篮。被弃卡不露正面，表示非指定选择。",
      "artSemantics": "历史参考费用 0。源效果：造成4点伤害，随机弃一 张牌。\n画面语义：直接伤害与随机弃一张手牌同时明确；不画成玩家选择弃牌、烧牌库或额外抽牌。",
      "forbiddenRefs": "不借用原灵魂之火的绿焰、颅骨、施法手势、符文或构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：discard_random",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-065",
      "sourceId": "VAN_CS2_065",
      "sourceRow": 34,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "minion",
      "typeLabel": "随从·恶魔",
      "tribe": "demon",
      "cost": 1,
      "attack": 1,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 34,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 1/3。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "墨契门卫",
      "nameStatus": "candidate",
      "artBrief": "原创契约纸偶由紫色厚封面和层叠页边组成，身体低宽，双臂展开挡住书店窄门。没有角、獠牙或人形暗影甲，胸前留一枚空白合同签。",
      "artSemantics": "历史参考费用 1。参考身材 1/3。源效果：嘲讽\n画面语义：随从带恶魔标签并具有嘲讽。契约纸偶只是待定视觉映射，不改种族规则或追加吸收伤害。",
      "forbiddenRefs": "不借用原虚空行者的头脸、肩部剪影、暗影体形、护甲或原构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-063",
      "sourceId": "VAN_CS2_063",
      "sourceRow": 35,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 35,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：选择一个敌方随从，在你的回合开始时，消灭该随从。"
      },
      "sourceEffectText": "选择一个敌方随从，在你的回合开始时，消灭该随从。",
      "effects": [
        {
          "clause": "选择一个敌方随从，在你的回合开始时，消灭该随从。",
          "mechanisms": [
            "destroy",
            "delayed_trigger",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "destroy",
        "delayed_trigger",
        "target_filter_minion"
      ],
      "name": "到期墨签",
      "nameStatus": "candidate",
      "artBrief": "火箭把一张紫色到期签贴在对侧纸偶身上，旁边独立小日历停在下一次己方回合的页边。目标仍完整站立，墨迹缓慢收拢。",
      "artSemantics": "历史参考费用 1。源效果：选择一个敌方随从，在你的回合开始时，消灭该随从。\n画面语义：指定一个敌方随从，到己方回合开始才消灭。插画不能表现立即消灭、回合结束触发或伤害。",
      "forbiddenRefs": "不借用原腐蚀人物、绿焰、触手、诅咒符号或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：destroy、delayed_trigger、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-302",
      "sourceId": "VAN_EX1_302",
      "sourceRow": 36,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 1,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 36,
        "column": "必保留语义",
        "text": "历史参考费用 1。源效果：对一个随从造成1点伤害。如果该随从死亡，抽一张牌。"
      },
      "sourceEffectText": "对一个随从造成1点伤害。如果该随从死亡，抽一张牌。",
      "effects": [
        {
          "clause": "对一个随从造成1点伤害。",
          "mechanisms": [
            "target_filter_minion",
            "damage_single"
          ]
        },
        {
          "clause": "如果该随从死亡，抽一张牌。",
          "mechanisms": [
            "conditional",
            "draw"
          ]
        }
      ],
      "requiredMechanisms": [
        "target_filter_minion",
        "damage_single",
        "conditional",
        "draw",
        "multi_effect"
      ],
      "name": "尾页收据",
      "nameStatus": "candidate",
      "artBrief": "一缕紫色订线轻触单个纸偶，纸偶若倒下，其后才露出一张新的空白收据卡。通过前后两段小景表达有条件的后续动作。",
      "artSemantics": "历史参考费用 1。源效果：对一个随从造成1点伤害。如果该随从死亡，抽一张牌。\n画面语义：先对一个随从造成伤害，仅该随从死亡时抽牌；不能表现无条件抽牌、英雄目标或任意死亡触发。",
      "forbiddenRefs": "不借用原死亡缠绕的骷髅、绿色能量、藤蔓形态或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：target_filter_minion、conditional、multi_effect（原型 CardDefinition 每张卡只有一个 effect，复合效果不能拆成单效果，源效果各子句完整保留）",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-306",
      "sourceId": "VAN_EX1_306",
      "sourceRow": 37,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "minion",
      "typeLabel": "随从·恶魔",
      "tribe": "demon",
      "cost": 2,
      "attack": 4,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 37,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 4/3。源效果：战吼： 随机弃一张牌。"
      },
      "sourceEffectText": "战吼： 随机弃一张牌。",
      "effects": [
        {
          "clause": "战吼： 随机弃一张牌。",
          "mechanisms": [
            "battlecry",
            "discard_random"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "discard_random"
      ],
      "name": "跳页契约兽",
      "nameStatus": "candidate",
      "artBrief": "原创紫色折页兽从合同册跃出，四条折纸短腿形成弹簧感，一张背面手牌被起跳气流随机卷走。外形像带书扣的方形纸团，不做犬类恶魔。",
      "artSemantics": "历史参考费用 2。参考身材 4/3。源效果：战吼： 随机弃一张牌。\n画面语义：恶魔随从，登场随机弃一张牌；纸兽并无冲锋。种族视觉映射待定，不改成野兽标签。",
      "forbiddenRefs": "不借用原魔犬的犬形头、触须、獠牙、肢体结构、配色或构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、discard_random",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-061",
      "sourceId": "VAN_CS2_061",
      "sourceRow": 38,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 3,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 38,
        "column": "必保留语义",
        "text": "历史参考费用 3。源效果：造成2点伤害，为你的英雄恢复2点生命值。"
      },
      "sourceEffectText": "造成2点伤害，为你的英雄恢复2点生命值。",
      "effects": [
        {
          "clause": "造成2点伤害，为你的英雄恢复2点生命值。",
          "mechanisms": [
            "heal_fixed_target",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "heal_fixed_target",
        "damage_single"
      ],
      "name": "借墨回温",
      "nameStatus": "candidate",
      "artBrief": "火箭伸出的笔尖与单个目标之间连着一段紫色墨线，另一条橙色暖线回到火箭胸前。伤害端与回复端用方向明确分开。",
      "artSemantics": "历史参考费用 3。源效果：造成2点伤害，为你的英雄恢复2点生命值。\n画面语义：伤害一个角色并为己方英雄恢复生命；不能改成等同实际伤害量的通用吸血或治疗所选角色。",
      "forbiddenRefs": "不借用原吸取生命的邪能束、恶魔手掌、灵魂形状或原构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：heal_fixed_target",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-057",
      "sourceId": "VAN_CS2_057",
      "sourceRow": 39,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 3,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 39,
        "column": "必保留语义",
        "text": "历史参考费用 3。源效果：对一个随从造成4点伤害。"
      },
      "sourceEffectText": "对一个随从造成4点伤害。",
      "effects": [
        {
          "clause": "对一个随从造成4点伤害。",
          "mechanisms": [
            "target_filter_minion",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "target_filter_minion",
        "damage_single"
      ],
      "name": "紫墨重印",
      "nameStatus": "candidate",
      "artBrief": "火箭一笔推出厚重方形紫墨印记，落向单个随从轮廓。粗笔触集中成一个冲击面，英雄位置与落点分开。",
      "artSemantics": "历史参考费用 3。源效果：对一个随从造成4点伤害。\n画面语义：只对一个随从造成伤害，不可因插画扩大到英雄或多目标。",
      "forbiddenRefs": "不使用原暗影箭的箭形能量、恶魔、符文、手势或构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-062",
      "sourceId": "VAN_CS2_062",
      "sourceRow": 40,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "spell",
      "typeLabel": "法术",
      "tribe": null,
      "cost": 4,
      "attack": null,
      "health": null,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 40,
        "column": "必保留语义",
        "text": "历史参考费用 4。源效果：对所有角色造成3点伤害。"
      },
      "sourceEffectText": "对所有角色造成3点伤害。",
      "effects": [
        {
          "clause": "对所有角色造成3点伤害。",
          "mechanisms": [
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "aoe"
      ],
      "name": "整店熏墨",
      "nameStatus": "candidate",
      "artBrief": "火箭失手合上过热笔记本，紫橙墨烟沿整个书店地面涌开。双方随从和两位英雄都在烟波内，以小幅受冲击姿态表现对称影响。",
      "artSemantics": "历史参考费用 4。源效果：对所有角色造成3点伤害。\n画面语义：所有角色都受伤，包含双方英雄；不能表现成只伤敌方、只伤随从或持续伤害场。",
      "forbiddenRefs": "不借用原地狱烈焰的恶魔地狱场景、绿焰、符文与原构图。",
      "artPriority": "P0 首批12",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-064",
      "sourceId": "VAN_CS2_064",
      "sourceRow": 41,
      "class": "warlock",
      "classLabel": "术士（火箭）",
      "hero": "rocket",
      "type": "minion",
      "typeLabel": "随从·恶魔",
      "tribe": "demon",
      "cost": 6,
      "attack": 6,
      "health": 6,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 41,
        "column": "必保留语义",
        "text": "历史参考费用 6。参考身材 6/6。源效果：战吼：对所有其他角色造成1点伤害。"
      },
      "sourceEffectText": "战吼：对所有其他角色造成1点伤害。",
      "effects": [
        {
          "clause": "战吼：对所有其他角色造成1点伤害。",
          "mechanisms": [
            "battlecry",
            "aoe"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "aoe"
      ],
      "name": "落柜契约巨像",
      "nameStatus": "candidate",
      "artBrief": "原创巨大紫色文件柜纸偶从高处落地，层叠合同页形成宽阔身体，落地波纹掠过周围每个角色。巨像站在波纹中央无伤，橙色书扣是唯一亮点。",
      "artSemantics": "历史参考费用 6。参考身材 6/6。源效果：战吼：对所有其他角色造成1点伤害。\n画面语义：恶魔随从，登场战吼伤害所有其他角色，排除自身但包含双方英雄。视觉族群映射待定，不添加嘲讽或反复震地。",
      "forbiddenRefs": "不借用原地狱火石巨人轮廓、熔岩裂缝、绿焰、面孔或陨落构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、aoe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-189",
      "sourceId": "VAN_CS2_189",
      "sourceRow": 42,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 1,
      "attack": 1,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 42,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 1/1。源效果：战吼：造成1点伤害。"
      },
      "sourceEffectText": "战吼：造成1点伤害。",
      "effects": [
        {
          "clause": "战吼：造成1点伤害。",
          "mechanisms": [
            "battlecry",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "damage_single"
      ],
      "name": "豆袋投手",
      "nameStatus": "candidate",
      "artBrief": "成年街区运动爱好者站在书店活动区右下方，左手保持平衡，右手刚投出唯一一枚小豆袋；豆袋及落点的一次短促墨点成为第二视觉焦点。背景仅有折叠座椅，避免出现连续弹道。",
      "artSemantics": "历史参考费用 1。参考身材 1/1。源效果：战吼：造成1点伤害。\n画面语义：战吼仅发生于登场；原文未限制伤害对象为敌方或随从。豆袋是这次伤害的视觉隐喻，不新增远程攻击或每回合投掷。",
      "forbiddenRefs": "不借用原作精灵族外形、弓箭手服饰或可识别人物；采用普通成人、运动便装和豆袋，自建侧向留白构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs1-042",
      "sourceId": "VAN_CS1_042",
      "sourceRow": 43,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 1,
      "attack": 1,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 43,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 1/2。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "门口挡风板",
      "nameStatus": "candidate",
      "artBrief": "一块长着小木脚的旧书店折叠挡风板正面撑开，占画面下方三分之二；圆形门洞与暖灯退居后方。挡板边缘磨损、脚边有纸屑，清楚形成必须先绕过的前景屏障。",
      "artSemantics": "历史参考费用 1。参考身材 1/2。源效果：嘲讽\n画面语义：只表达嘲讽的目标优先限制，不新增护甲、减伤、护盾或保护后排的独立规则；虽然画成活动道具，类型仍为随从。",
      "forbiddenRefs": "不借用原作地名、城镇纹章、士兵制服或盾牌造型；挡板几何轮廓、贴纸和姿态独立设计。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-508",
      "sourceId": "VAN_EX1_508",
      "sourceRow": 44,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·鱼人",
      "tribe": "murloc",
      "cost": 1,
      "attack": 1,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 44,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 1/1。源效果：所有其他鱼人拥有+1攻击力。"
      },
      "sourceEffectText": "所有其他鱼人拥有+1攻击力。",
      "effects": [
        {
          "clause": "所有其他鱼人拥有+1攻击力。",
          "mechanisms": [
            "aura",
            "target_filter_tribe"
          ]
        }
      ],
      "requiredMechanisms": [
        "aura",
        "target_filter_tribe"
      ],
      "name": "折页领唱",
      "nameStatus": "candidate",
      "artBrief": "原创折页族的小领唱站在中央书箱上，扁圆纸绳头与翻页耳形成剪影；左右远景分别站着佩不同队标的同族，双方都沿同一声波挺直身子。主体自身不加亮，强调影响的是其他同族。",
      "artSemantics": "历史参考费用 1。参考身材 1/1。源效果：所有其他鱼人拥有+1攻击力。\n画面语义：必须保留“所有其他鱼人”，包括敌方鱼人，不能换成“你的其他鱼人”；仅加攻击，不加生命。原类型“随从·鱼人”保留；“折页族”仅是暂拟视觉族群，种族名称及规则映射待设计决定。",
      "forbiddenRefs": "不借用原作鱼人的头身比例、眼口、鳍、鳞、叫声形象、装束或标志；折页族从纸绳与装订耳独立设计，不沿用原画构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aura、target_filter_tribe",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-168",
      "sourceId": "VAN_CS2_168",
      "sourceRow": 45,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·鱼人",
      "tribe": "murloc",
      "cost": 1,
      "attack": 2,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 45,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 2/1。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "折页搬箱客",
      "nameStatus": "candidate",
      "artBrief": "单个原创折页族背着空木箱走过烧烤店侧门，纸绳扁圆头和翻页耳与同族一致；低视角突出双脚与窄肩，背景只留墙面，动作停在稳稳跨步的一刻，没有速度线或额外伙伴。",
      "artSemantics": "历史参考费用 1。参考身材 2/1。源效果：（无效果）\n画面语义：无效果随从，不能因搬箱动作暗示抽牌、生成物品、冲锋或资源收益。原类型“随从·鱼人”保留；折页族仅暂拟视觉映射，规则与种族改名待决定。",
      "forbiddenRefs": "不借用原作鱼人外形、武器、部落符号或人物姿态；使用纸材结构与原创搬箱生活场景。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2168",
        "name": "折页搬箱客",
        "type": "minion",
        "cost": 1,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 2,
        "health": 1
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 2,
          "health": 1,
          "manaSpent": 1
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-171",
      "sourceId": "VAN_CS2_171",
      "sourceRow": 46,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 1,
      "attack": 1,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 46,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 1/1。源效果：冲锋"
      },
      "sourceEffectText": "冲锋",
      "effects": [
        {
          "clause": "冲锋",
          "mechanisms": [
            "keyword_charge"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge"
      ],
      "name": "巷口卷尾犬",
      "nameStatus": "candidate",
      "artBrief": "一只矮小卷尾犬从书店门槛右侧蹿到前景，四足离地、耳朵后贴，单一弧形速度线从后方延伸；胸前细布围巾形成辨识色点，身体本身仍是普通小犬，无獠牙或装甲。",
      "artSemantics": "历史参考费用 1。参考身材 1/1。源效果：冲锋\n画面语义：保留冲锋，不降为突袭，也不新增入场伤害。原“随从·野兽”标签不变；改成原创犬只仅为野兽视觉候选，不改变数值或效果。",
      "forbiddenRefs": "不借用原作石质獠牙、野猪造型或原卡构图；犬种比例、围巾和跃起方向独立绘制。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-011",
      "sourceId": "VAN_EX1_011",
      "sourceRow": 47,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 1,
      "attack": 2,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 47,
        "column": "必保留语义",
        "text": "历史参考费用 1。参考身材 2/1。源效果：战吼： 恢复2点生命值。"
      },
      "sourceEffectText": "战吼： 恢复2点生命值。",
      "effects": [
        {
          "clause": "战吼： 恢复2点生命值。",
          "mechanisms": [
            "battlecry",
            "heal_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "heal_single"
      ],
      "name": "热毛巾摊主",
      "nameStatus": "candidate",
      "artBrief": "成人小摊主端着一只浅盘，从画面左侧递出一条冒着柔和暖气的折叠毛巾；主焦点为双手和毛巾，右边只露一个接收者的手。背景是奶茶街休息凳，不出现药品、图腾或群体光环。",
      "artSemantics": "历史参考费用 1。参考身材 2/1。源效果：战吼： 恢复2点生命值。\n画面语义：战吼恢复2点生命，原文未限定为己方或英雄；画面只示意一次恢复，不新增治疗持续时间或群体治疗。",
      "forbiddenRefs": "不借用原作巫术面具、族群体貌、仪式物件或特色服装；以生活照料动作和普通成人形象原创。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-066",
      "sourceId": "VAN_EX1_066",
      "sourceRow": 48,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 2,
      "attack": 3,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 48,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 3/2。源效果：战吼： 摧毁对手的武器。"
      },
      "sourceEffectText": "战吼： 摧毁对手的武器。",
      "effects": [
        {
          "clause": "战吼： 摧毁对手的武器。",
          "mechanisms": [
            "battlecry",
            "destroy_weapon"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "destroy_weapon"
      ],
      "name": "拆扣小蟹",
      "nameStatus": "candidate",
      "artBrief": "一个由旧夹子、木珠和软布脚组成的小蟹形活动工具占前景，单只大夹刚拆开对侧一把训练拍的连接扣；断开的拍柄与拍面分离清晰，旁边的人物完整无伤。仅画一次拆解瞬间。",
      "artSemantics": "历史参考费用 2。参考身材 3/2。源效果：战吼： 摧毁对手的武器。\n画面语义：战吼摧毁对手的武器，不是偷取、沉默、减耐久或伤害对方英雄。源类型仅“随从”，蟹形道具外观不自动获得野兽或机械标签。",
      "forbiddenRefs": "不借用原作软泥生物轮廓、面孔、酸液色彩或沼泽布景；不采用液体腐蚀表现，原创夹扣结构与构图。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、destroy_weapon",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-172",
      "sourceId": "VAN_CS2_172",
      "sourceRow": 49,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 2,
      "attack": 3,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 49,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 3/2。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "长腿杏斑猫",
      "nameStatus": "candidate",
      "artBrief": "一只长腿杏色斑猫横跨前景矮墙，窄身与伸展前爪构成有力的斜线；后方是未开门的烧烤摊卷帘，猫回头看向画外，没有冲刺线、猎物或效果光，突出轻巧而有攻击性的身体比例。",
      "artSemantics": "历史参考费用 2。参考身材 3/2。源效果：（无效果）\n画面语义：保留野兽标签和无效果状态；锋利爪子只表达身材气质，不新增潜行、冲锋或撕裂效果。",
      "forbiddenRefs": "不借用原作迅猛龙的身体、皮纹、头部或沼泽场景；采用原创猫形、花纹和日常墙面构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2172",
        "name": "长腿杏斑猫",
        "type": "minion",
        "cost": 2,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 3,
        "health": 2
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 3,
          "health": 2,
          "manaSpent": 2
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-173",
      "sourceId": "VAN_CS2_173",
      "sourceRow": 50,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·鱼人",
      "tribe": "murloc",
      "cost": 2,
      "attack": 2,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 50,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 2/1。源效果：冲锋"
      },
      "sourceEffectText": "冲锋",
      "effects": [
        {
          "clause": "冲锋",
          "mechanisms": [
            "keyword_charge"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge"
      ],
      "name": "折页急送客",
      "nameStatus": "candidate",
      "artBrief": "原创折页族抱着圆筒包裹从科技街拐角切入画面，脚踏无动力小滑板；身体和包裹朝同一方向前倾，近景轮子大、远景店牌小，长书签尾带和一条速度弧强调登场即行动。",
      "artSemantics": "历史参考费用 2。参考身材 2/1。源效果：冲锋\n画面语义：保留冲锋及“随从·鱼人”标签；折页族的种族名称与规则映射待决定。包裹不产生卡牌，滑板不算武器，也不新增快递收益。",
      "forbiddenRefs": "不借用原作鱼人身体特征、蓝鳃配色标识、武装或冲刺构图；纸绳头、翻页耳与滑板场景独立设计。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-121",
      "sourceId": "VAN_CS2_121",
      "sourceRow": 51,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 2,
      "attack": 2,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 51,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 2/2。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "雨棚看守",
      "nameStatus": "candidate",
      "artBrief": "穿厚帆布雨衣的成年街坊把一把闭合大伞横在窄巷入口，站姿宽而稳定；伞与双臂占前景，背后的奶茶店雨棚与排队空栏低对比处理。伞无徽章，正面屏障是唯一机制线索。",
      "artSemantics": "历史参考费用 2。参考身材 2/2。源效果：嘲讽\n画面语义：只表达嘲讽；伞不提供圣盾、反弹或天气效果，不因人物挡雨获得其他能力。",
      "forbiddenRefs": "不借用原作兽人或部落族群轮廓、狼饰、盔甲与徽记；原创普通成人雨衣及巷口布局。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-142",
      "sourceId": "VAN_CS2_142",
      "sourceRow": 52,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 2,
      "attack": 2,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 52,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 2/2。源效果：法术伤害+1"
      },
      "sourceEffectText": "法术伤害+1",
      "effects": [
        {
          "clause": "法术伤害+1",
          "mechanisms": [
            "spell_damage"
          ]
        }
      ],
      "requiredMechanisms": [
        "spell_damage"
      ],
      "name": "增幅唱针匠",
      "nameStatus": "candidate",
      "artBrief": "成年唱片修理师俯身调整桌上小型声纹放大器，右手转动唯一的刻度旋钮；细线从左侧纸带进入，右侧输出变粗一档的墨色波纹。人物和旋钮为主，机器保留轻巧轮廓，不占满画面。",
      "artSemantics": "历史参考费用 2。参考身材 2/2。源效果：法术伤害+1\n画面语义：法术伤害+1是持续修正，不能画成一次战吼伤害或给随从加攻击。源类型仅“随从”；技术装置不自动赋予机械标签。",
      "forbiddenRefs": "不借用原作狗头人外形、蜡烛头饰、地卜法器或符文；用原创唱针器械与纸带图形表达增幅。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：spell_damage",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-506",
      "sourceId": "VAN_EX1_506",
      "sourceRow": 53,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·鱼人",
      "tribe": "murloc",
      "cost": 2,
      "attack": 2,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 53,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 2/1。源效果：战吼：召唤一个1/1的鱼人斥候。"
      },
      "sourceEffectText": "战吼：召唤一个1/1的鱼人斥候。",
      "effects": [
        {
          "clause": "战吼：召唤一个1/1的鱼人斥候。",
          "mechanisms": [
            "battlecry",
            "summon"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "summon"
      ],
      "name": "折页引路客",
      "nameStatus": "candidate",
      "artBrief": "原创折页族成人体量的引路客在书店后门侧身拉开布帘，主角占左侧约三分之二；右下方走出恰好一位较小的同族伙伴，双方的翻页耳和纸绳头一致，背景不再安排其他人影。",
      "artSemantics": "历史参考费用 2。参考身材 2/1。源效果：战吼：召唤一个1/1的鱼人斥候。\n画面语义：战吼只召唤一个1/1“鱼人斥候”。主卡保留“随从·鱼人”；衍生物原身份与鱼人语义保留，拟视觉名“折页探路客”及折页族规则映射待设计决定，不能直接当作已改名的新规则。",
      "forbiddenRefs": "不借用原作鱼人及斥候身体、鱼叉、海潮地貌或成对构图；独立设计纸材族群和掀帘登场视角。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、summon",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-015",
      "sourceId": "VAN_EX1_015",
      "sourceRow": 54,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 2,
      "attack": 1,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 54,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 1/1。源效果：战吼：抽一张牌。"
      },
      "sourceEffectText": "战吼：抽一张牌。",
      "effects": [
        {
          "clause": "战吼：抽一张牌。",
          "mechanisms": [
            "battlecry",
            "draw"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "draw"
      ],
      "name": "借阅登记员",
      "nameStatus": "candidate",
      "artBrief": "戴圆框眼镜的成年登记员坐在低矮服务台后，刚从抽屉取出唯一一张空白借阅卡，卡片斜向伸至前景成为最亮区域；人物身体刻意纤小，周边书本合拢，避免多张散飞纸片。",
      "artSemantics": "历史参考费用 2。参考身材 1/1。源效果：战吼：抽一张牌。\n画面语义：战吼抽一张牌，不能变成发现、复制、检索指定类别或补满手牌。空白借阅卡只隐喻抽牌，不是新增实体资源。",
      "forbiddenRefs": "不借用原作工程师的族群比例、发型、护目镜或机械台布置；采用原创普通成人与借阅柜台。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-120",
      "sourceId": "VAN_CS2_120",
      "sourceRow": 55,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 2,
      "attack": 2,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 55,
        "column": "必保留语义",
        "text": "历史参考费用 2。参考身材 2/3。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "河岸圆鼻獾",
      "nameStatus": "candidate",
      "artBrief": "一只圆鼻短腿獾在街区排水沟旁蹲坐，身体呈结实的横向豆形；镜头平视，前爪压在一片普通落叶边，后方是温暖石阶和几株草。腹部体量比动作更醒目，不配战斗特效。",
      "artSemantics": "历史参考费用 2。参考身材 2/3。源效果：（无效果）\n画面语义：保留“随从·野兽”和无效果，厚实外形不表示嘲讽或减伤。动物种类改变仅是原创视觉候选。",
      "forbiddenRefs": "不借用原作鳄鱼嘴部、鳞甲、配色或河流构图；原创獾形与街区石阶场景。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2120",
        "name": "河岸圆鼻獾",
        "type": "minion",
        "cost": 2,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 2,
        "health": 3
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 2,
          "health": 3,
          "manaSpent": 2
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-582",
      "sourceId": "VAN_EX1_582",
      "sourceRow": 56,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 1,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 56,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 1/4。源效果：法术伤害+1"
      },
      "sourceEffectText": "法术伤害+1",
      "effects": [
        {
          "clause": "法术伤害+1",
          "mechanisms": [
            "spell_damage"
          ]
        }
      ],
      "requiredMechanisms": [
        "spell_damage"
      ],
      "name": "夜校描线师",
      "nameStatus": "candidate",
      "artBrief": "成年夜校教师站在竖向描图灯箱旁，细长身形藏在宽围裙里；灯箱左侧输入一条细墨线，右侧透出略粗的单线，手持透明尺而非武器。灯箱厚框和安稳站姿表达耐受，增强纹样为次焦点。",
      "artSemantics": "历史参考费用 3。参考身材 1/4。源效果：法术伤害+1\n画面语义：法术伤害+1持续存在，与其他同效果卡同幅度；不能因较高生命值画出额外治疗或护盾。",
      "forbiddenRefs": "不借用原作城市名、学院纹章、法袍、种族特征或施法姿态；用原创夜校教具和描线动作。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：spell_damage",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-141",
      "sourceId": "VAN_CS2_141",
      "sourceRow": 57,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 2,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 57,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 2/2。源效果：战吼：造成1点伤害。"
      },
      "sourceEffectText": "战吼：造成1点伤害。",
      "effects": [
        {
          "clause": "战吼：造成1点伤害。",
          "mechanisms": [
            "battlecry",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "damage_single"
      ],
      "name": "气筒练习员",
      "nameStatus": "candidate",
      "artBrief": "烧烤街飞镖摊的成年练习员肩抵一支短木气筒，朝画外打一粒软木塞；主角在画面右侧，唯一软木塞与一次墨点冲击向左留出空间。背景折叠靶架只作摊位标识，不画第二次射击。",
      "artSemantics": "历史参考费用 3。参考身材 2/2。源效果：战吼：造成1点伤害。\n画面语义：战吼造成1点伤害，原文未限定敌方或随从；气筒不意味着持续远程、额外攻击次数或自带武器。",
      "forbiddenRefs": "不借用原作矮人外形、城市锻造标志、枪械或枪手姿态；木气筒结构及游艺摊构图独立设计。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-125",
      "sourceId": "VAN_CS2_125",
      "sourceRow": 58,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 3,
      "attack": 3,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 58,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 3/3。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "书巷厚掌熊",
      "nameStatus": "candidate",
      "artBrief": "原创圆耳棕熊四掌撑在狭窄书巷入口，胸前只有一条素色布带；低视角使宽肩成为正面屏障，后方书箱与门牌被身体部分遮挡。毛发用短墨块而非金属尖刺处理，表情专注且不凶残。",
      "artSemantics": "历史参考费用 3。参考身材 3/3。源效果：嘲讽\n画面语义：保留“随从·野兽”和嘲讽；熊的阻挡姿态不附带护甲或伤害减免。",
      "forbiddenRefs": "熊这一通用动物意象可保留，但不借用原卡铁鬃设计、毛色花纹、姿势或森林构图；体型与服饰重新创作。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-118",
      "sourceId": "VAN_CS2_118",
      "sourceRow": 59,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 5,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 59,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 5/1。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "薄脆炭雕",
      "nameStatus": "candidate",
      "artBrief": "夜市手工摊上一尊高挑的炭纸活动雕塑探出展架，长手臂和尖折边伸向画面两侧；身体薄如层叠脆片，背光处清楚可见细裂纹。用强横向轮廓表现攻击性，用脆薄侧面表现低耐受。",
      "artSemantics": "历史参考费用 3。参考身材 5/1。源效果：（无效果）\n画面语义：无效果的5/1随从；炭纸与裂纹只表达高攻低血，不新增灼烧、亡语、受到伤害时爆炸或火焰种族。",
      "forbiddenRefs": "不借用原作熔岩元素的躯体、发光裂隙、怒脸或喷火构图；采用哑光炭纸艺术品与夜市展示背景。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2118",
        "name": "薄脆炭雕",
        "type": "minion",
        "cost": 3,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 5,
        "health": 1
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 5,
          "health": 1,
          "manaSpent": 3
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-122",
      "sourceId": "VAN_CS2_122",
      "sourceRow": 60,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 2,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 60,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 2/2。源效果：你的其他随从拥有+1攻击力。"
      },
      "sourceEffectText": "你的其他随从拥有+1攻击力。",
      "effects": [
        {
          "clause": "你的其他随从拥有+1攻击力。",
          "mechanisms": [
            "aura"
          ]
        }
      ],
      "requiredMechanisms": [
        "aura"
      ],
      "name": "街坊领拍员",
      "nameStatus": "candidate",
      "artBrief": "成年社区合奏领拍员站在近景中央打拍子，自身保持墨灰；后方同一侧三位原创街坊的手部各出现相同单枚尖角节拍记号，另一侧远景人影不受影响。主体与伙伴形成展开的扇形关系。",
      "artSemantics": "历史参考费用 3。参考身材 2/2。源效果：你的其他随从拥有+1攻击力。\n画面语义：你的其他随从持续拥有+1攻击力；不影响自身、敌方、英雄或生命值，也不是只触发一次的战吼。保留经典2/2，不使用对比列2/3。",
      "forbiddenRefs": "不借用原作军队装束、指挥旗、族群或领袖姿势；原创社区合奏生活场面，单尖角仅作攻击增益隐喻。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aura",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-196",
      "sourceId": "VAN_CS2_196",
      "sourceRow": 61,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 2,
      "health": 3,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 61,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 2/3。源效果：战吼：召唤一个1/1的野猪。"
      },
      "sourceEffectText": "战吼：召唤一个1/1的野猪。",
      "effects": [
        {
          "clause": "战吼：召唤一个1/1的野猪。",
          "mechanisms": [
            "battlecry",
            "summon"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "summon"
      ],
      "name": "后巷觅物人",
      "nameStatus": "candidate",
      "artBrief": "成年旧物搜集者蹲在前景打开空布袋，一只恰好单独出现的小猪从旁边矮门探出并跨入灯光；人物占画面左侧约三分之二，小猪在右下方保留完整轮廓。周围纸箱闭合，不再藏其他动物。",
      "artSemantics": "历史参考费用 3。参考身材 2/3。源效果：战吼：召唤一个1/1的野猪。\n画面语义：战吼召唤一个1/1的野猪；主卡仍只是“随从”，不能因同伴而给主卡加野兽标签。拟衍生物视觉名“后巷小鼻头”，原“野猪”身份与1/1不删除；额外种族字段源表未单列，接入前另核，不臆造。",
      "forbiddenRefs": "不借用原作猎手族群、獠牙装束、猎具与荆棘地景；小猪采用独立圆鼻和短腿比例，不照原卡或衍生物造型。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、summon",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-019",
      "sourceId": "VAN_EX1_019",
      "sourceRow": 62,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 3,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 62,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 3/2。源效果：战吼：使一个友方随从获得+1/+1。"
      },
      "sourceEffectText": "战吼：使一个友方随从获得+1/+1。",
      "effects": [
        {
          "clause": "战吼：使一个友方随从获得+1/+1。",
          "mechanisms": [
            "battlecry",
            "buff",
            "target_filter_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "buff",
        "target_filter_minion"
      ],
      "name": "书包补线师",
      "nameStatus": "candidate",
      "artBrief": "成年补线师侧身为唯一一位同侧伙伴的旧书包补上结实方形补丁，缝线一尖一圆两枚结头同时可见；被帮助者位于前景，补线师退半步。其他人物与物件压暗，无向全场扩散的光。",
      "artSemantics": "历史参考费用 3。参考身材 3/2。源效果：战吼：使一个友方随从获得+1/+1。\n画面语义：战吼使一个友方随从获得+1/+1，仅一个友方随从；不是治疗、加护甲、群体增益或持续光环。两种结头只作攻击/生命双增益提示。",
      "forbiddenRefs": "不借用原作组织名称、太阳纹章、祭司法袍、种族或祝福手势；原创修补行为与布料图形。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、buff、target_filter_minion",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-127",
      "sourceId": "VAN_CS2_127",
      "sourceRow": 63,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 3,
      "attack": 1,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 63,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 1/4。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "门廊蓬尾狸",
      "nameStatus": "candidate",
      "artBrief": "一只年长外观的原创蓬尾狸伏在窄门廊前，硕大卷尾铺成前景弧形屏障，小爪与圆脸藏在尾后；镜头略低，背景只有两级台阶。主次是厚尾在前、身体在后，神态温和但不让路。",
      "artSemantics": "历史参考费用 3。参考身材 1/4。源效果：嘲讽\n画面语义：保留“随从·野兽”和嘲讽；年长、宽尾和较高生命只是视觉语气，不新增族长光环、治疗或减伤。",
      "forbiddenRefs": "不借用原作猩猩身体、银背纹样、族长装饰或丛林场面；采用完全不同的原创狸形和门廊布局。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-124",
      "sourceId": "VAN_CS2_124",
      "sourceRow": 64,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 3,
      "attack": 3,
      "health": 1,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 64,
        "column": "必保留语义",
        "text": "历史参考费用 3。参考身材 3/1。源效果：冲锋"
      },
      "sourceEffectText": "冲锋",
      "effects": [
        {
          "clause": "冲锋",
          "mechanisms": [
            "keyword_charge"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge"
      ],
      "name": "单轮赶集人",
      "nameStatus": "candidate",
      "artBrief": "成年赶集人踩着单轮小车从左下方冲向右上方，长条购物袋沿风向拉直；车轮大特写、脸与肩靠近画面上沿，路边摊伞只留下快速后退的色块。人体轮廓纤长，装备轻巧。",
      "artSemantics": "历史参考费用 3。参考身材 3/1。源效果：冲锋\n画面语义：保留冲锋，不是突袭或额外攻击；主卡类型仅“随从”，小车不增加机械标签，也没有召唤坐骑或运输收益。",
      "forbiddenRefs": "不借用原作骑手族群、狼坐骑、甲胄、战旗或冲锋视角；原创单轮车和赶集日常服饰。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-182",
      "sourceId": "VAN_CS2_182",
      "sourceRow": 65,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 4,
      "health": 5,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 65,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 4/5。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "棉被巡游偶",
      "nameStatus": "candidate",
      "artBrief": "书店周末展览的高大布艺活动偶站在街角，方圆拼接身体由厚棉被和素布组成，短手臂自然下垂；全身三分之四视角，脚边普通折椅提供体量参照。纹样只用宽条缝线，没有发光或动作特效。",
      "artSemantics": "历史参考费用 4。参考身材 4/5。源效果：（无效果）\n画面语义：无效果4/5随从；厚布外观不暗示嘲讽、减伤、冻结、护盾或额外族群标签。",
      "forbiddenRefs": "不借用原作雪人身体比例、角、毛皮、冰雪地景或人物构图；原创非雪怪布艺造型。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2182",
        "name": "棉被巡游偶",
        "type": "minion",
        "cost": 4,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 4,
        "health": 5
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 4,
          "health": 5,
          "manaSpent": 4
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-025",
      "sourceId": "VAN_EX1_025",
      "sourceRow": 66,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 2,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 66,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 2/4。源效果：战吼：召唤一个2/1的机械幼龙。"
      },
      "sourceEffectText": "战吼：召唤一个2/1的机械幼龙。",
      "effects": [
        {
          "clause": "战吼：召唤一个2/1的机械幼龙。",
          "mechanisms": [
            "battlecry",
            "summon"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "summon"
      ],
      "name": "风轮装配师",
      "nameStatus": "candidate",
      "artBrief": "成年装配师蹲在科技街工作台旁掀开小木箱，一架恰好一台、纸扇翅与三轮底座的微型风轮从箱中滑出；人物稳占左侧，右下方完整展示衍生装置，背景工具收纳整齐。",
      "artSemantics": "历史参考费用 4。参考身材 2/4。源效果：战吼：召唤一个2/1的机械幼龙。\n画面语义：战吼只召唤一个2/1“机械幼龙”。主卡类型仅“随从”；拟衍生物视觉名“纸扇风轮”只是候选，原机械幼龙身份和2/1保留，召唤物独立种族字段源表未列，待核验与设计决定，不自行赋值。",
      "forbiddenRefs": "不借用原作技工族群、龙形零件、机械幼龙身体和车间构图；装置采用非龙形纸扇与三轮结构。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、summon",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-147",
      "sourceId": "VAN_CS2_147",
      "sourceRow": 67,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 2,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 67,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 2/4。源效果：战吼：抽一张牌。"
      },
      "sourceEffectText": "战吼：抽一张牌。",
      "effects": [
        {
          "clause": "战吼：抽一张牌。",
          "mechanisms": [
            "battlecry",
            "draw"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "draw"
      ],
      "name": "旧报索引员",
      "nameStatus": "candidate",
      "artBrief": "成年索引员靠在高文件柜前，把唯一一张索引卡从密闭卡槽抽到镜头前；宽围裙和稳定站姿占画面中轴，索引卡为最亮的小面积焦点。背景成排抽屉全部合上，不出现更多飞散卡片。",
      "artSemantics": "历史参考费用 4。参考身材 2/4。源效果：战吼：抽一张牌。\n画面语义：战吼抽一张牌，不是检索、发现、从牌库挑选或给对手抽牌；2/4身材与其他抽牌随从分开保留。",
      "forbiddenRefs": "不借用原作侏儒族群、发明家头部比例、护具、装置或姿态；原创普通成人档案工作场景。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-119",
      "sourceId": "VAN_CS2_119",
      "sourceRow": 68,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 4,
      "attack": 2,
      "health": 7,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 68,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 2/7。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "窄巷厚壳蜗",
      "nameStatus": "candidate",
      "artBrief": "一只巨大的普通蜗牛停在书店侧墙下，厚重圆壳占画面近四分之三，小头与触角仅伸出一点；壳面采用原创宽条螺旋分区，暖光照亮安静石地，没有挡路姿势、发光屏障或攻击动作。",
      "artSemantics": "历史参考费用 4。参考身材 2/7。源效果：（无效果）\n画面语义：保留“随从·野兽”和无效果2/7；厚壳只是高生命的形体提示，绝不等同护甲、嘲讽或伤害减免。",
      "forbiddenRefs": "不借用原作龟类钳嘴、龟甲纹样、绿洲布景或构图；改用原创蜗牛与街巷场景。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2119",
        "name": "窄巷厚壳蜗",
        "type": "minion",
        "cost": 4,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 2,
        "health": 7
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 2,
          "health": 7,
          "manaSpent": 4
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-197",
      "sourceId": "VAN_CS2_197",
      "sourceRow": 69,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 4,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 69,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 4/4。源效果：法术伤害+1"
      },
      "sourceEffectText": "法术伤害+1",
      "effects": [
        {
          "clause": "法术伤害+1",
          "mechanisms": [
            "spell_damage"
          ]
        }
      ],
      "requiredMechanisms": [
        "spell_damage"
      ],
      "name": "墨线调音客",
      "nameStatus": "candidate",
      "artBrief": "一位宽肩成年街头表演者抱着方形木质调音箱，左右两手保持对称操作；一条细墨纹穿过箱口后变粗一档，在空中形成短而清晰的平滑曲线。身体与箱体各占半幅，背景简洁。",
      "artSemantics": "历史参考费用 4。参考身材 4/4。源效果：法术伤害+1\n画面语义：法术伤害+1持续修正，不因强壮身形增加更多法伤；声波不是登场伤害、攻击力光环或群体控制。",
      "forbiddenRefs": "不借用原作食人魔的头部数量、身体特征、法器、服装或施法构图；原创普通成人和木制调音箱。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：spell_damage",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-179",
      "sourceId": "VAN_CS2_179",
      "sourceRow": 70,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 3,
      "health": 5,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 70,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 3/5。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "折桌守门人",
      "nameStatus": "candidate",
      "artBrief": "穿素色工作背心的成年壮实街坊把一张折叠木桌竖起，桌面横贯前景形成完整遮挡；人物从桌侧露头，双脚撑稳。后方是奶茶店侧门，桌腿结构清晰，避免画成带纹章的战盾。",
      "artSemantics": "历史参考费用 4。参考身材 3/5。源效果：嘲讽\n画面语义：保留嘲讽；桌面不提供圣盾、护甲、反击或新武器，仅是强制优先目标的画面语言。",
      "forbiddenRefs": "不借用原作专有地名、巨魔族貌、盾形、面饰和图腾纹样；以原创木桌和普通成人重建轮廓。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-131",
      "sourceId": "VAN_CS2_131",
      "sourceRow": 71,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 4,
      "attack": 2,
      "health": 5,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 71,
        "column": "必保留语义",
        "text": "历史参考费用 4。参考身材 2/5。源效果：冲锋"
      },
      "sourceEffectText": "冲锋",
      "effects": [
        {
          "clause": "冲锋",
          "mechanisms": [
            "keyword_charge"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge"
      ],
      "name": "邮袋滑行员",
      "nameStatus": "candidate",
      "artBrief": "成年邮袋收集员伏在结实的脚踏货板车上从奶茶街斜坡滑入，厚邮袋垫在胸前且车架稳固；低视角突出大前轮与向前眼神，身后仅一束速度线，整幅运动方向单一。",
      "artSemantics": "历史参考费用 4。参考身材 2/5。源效果：冲锋\n画面语义：保留冲锋与2/5身材，不把较高生命画成圣盾或护甲；邮袋不触发抽牌，车辆不赋予机械标签。",
      "forbiddenRefs": "不借用原作城市纹章、骑士甲胄、坐骑或冲锋画面；原创成人邮务便装、货板车及坡道。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-187",
      "sourceId": "VAN_CS2_187",
      "sourceRow": 72,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 5,
      "attack": 5,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 72,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考身材 5/4。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "摊街拦车员",
      "nameStatus": "candidate",
      "artBrief": "高挑而结实的成年街区志愿者两脚分开，横举一条宽木拦车杆，杆头和手臂形成强烈横线；近景拦杆占主位，身后的折叠摊车压成小形。表情认真，衣着为无标识工装。",
      "artSemantics": "历史参考费用 5。参考身材 5/4。源效果：嘲讽\n画面语义：只表达嘲讽及5/4身材，不新增拦截移动、缴械、冻结或守护指定单位等规则。",
      "forbiddenRefs": "不借用原作港湾地名、保镖族群、海盗纹章、武装或姿态；原创街市设施和成人志愿者。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ds1-055",
      "sourceId": "VAN_DS1_055",
      "sourceRow": 73,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 5,
      "attack": 4,
      "health": 5,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 73,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考身材 4/5。源效果：战吼：为所有友方角色恢复2点生命值。"
      },
      "sourceEffectText": "战吼：为所有友方角色恢复2点生命值。",
      "effects": [
        {
          "clause": "战吼：为所有友方角色恢复2点生命值。",
          "mechanisms": [
            "battlecry",
            "aoe",
            "heal_fixed_target"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "aoe",
        "heal_fixed_target"
      ],
      "name": "夜市递汤人",
      "nameStatus": "candidate",
      "artBrief": "成年汤摊主人在近景提起圆壶，柔和蒸汽分成几股流向同一侧的街坊及一位坐在店主椅上的原创代表人物；对侧没有蒸汽，主体自身也处在暖汽范围。多人的碗只做小亮点。",
      "artSemantics": "历史参考费用 5。参考身材 4/5。源效果：战吼：为所有友方角色恢复2点生命值。\n画面语义：战吼为所有友方角色恢复2点生命，含友方英雄与友方随从；不是仅随从、仅英雄或给生命上限加2。暖汽不表示持续治疗。",
      "forbiddenRefs": "不借用原作暗鳞族群、鱼尾鳞片、治疗法器、服装或光环造型；原创普通成人汤摊和群体递汤空间。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、aoe、heal_fixed_target",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-226",
      "sourceId": "VAN_CS2_226",
      "sourceRow": 74,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 5,
      "attack": 4,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 74,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考身材 4/4。源效果：战吼：战场上每有一个其他友方随从，便获得+1/+1。"
      },
      "sourceEffectText": "战吼：战场上每有一个其他友方随从，便获得+1/+1。",
      "effects": [
        {
          "clause": "战吼：战场上每有一个其他友方随从，便获得+1/+1。",
          "mechanisms": [
            "battlecry",
            "buff",
            "scaling"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "buff",
        "scaling"
      ],
      "name": "合力布展人",
      "nameStatus": "candidate",
      "artBrief": "成年布展者居中托住一块空白展板，旁边恰好三位同侧伙伴各递上一组小支架；支架朝主角汇拢，主体肩背随之显得更挺拔。人物关系清楚且无循环箭头，另一侧观众不提供支架。",
      "artSemantics": "历史参考费用 5。参考身材 4/4。源效果：战吼：战场上每有一个其他友方随从，便获得+1/+1。\n画面语义：战吼按登场时战场上每一个其他友方随从各得+1/+1；不计自身、敌方随从或英雄。画中三位只是构图示例，不把规则写死为+3/+3，也不是持续随场面重算。",
      "forbiddenRefs": "不借用原作狼饰、督军族群、军队徽记、战旗和检阅构图；原创社区布展协作场景。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、buff、scaling",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-399",
      "sourceId": "VAN_EX1_399",
      "sourceRow": 75,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 5,
      "attack": 2,
      "health": 7,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 75,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考身材 2/7。源效果：每当本随从受到伤害，获得+3攻击力。"
      },
      "sourceEffectText": "每当本随从受到伤害，获得+3攻击力。",
      "effects": [
        {
          "clause": "每当本随从受到伤害，获得+3攻击力。",
          "mechanisms": [
            "trigger",
            "buff"
          ]
        }
      ],
      "requiredMechanisms": [
        "trigger",
        "buff"
      ],
      "name": "磕碰练力偶",
      "nameStatus": "candidate",
      "artBrief": "一只缝制布练力偶立在街区运动角，左肩刚被软垫轻碰的位置出现小凹痕，右臂随之绷紧并扬起；身体厚实、脚步不动，镜头突出“碰触在先、发力在后”的单一因果，不画重复分身。",
      "artSemantics": "历史参考费用 5。参考身材 2/7。源效果：每当本随从受到伤害，获得+3攻击力。\n画面语义：每当本随从受到伤害便获得+3攻击力；不是仅首次、仅战吼、仅受伤状态或临时本回合增益。保留经典2/7，不使用对比列2/8；不得画成受伤后回血。",
      "forbiddenRefs": "不借用原作专有族名、巨魔外形、战士纹身、武器或暴怒姿态；原创布偶材质及软垫练力场景。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：trigger、buff",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-ex1-593",
      "sourceId": "VAN_EX1_593",
      "sourceRow": 76,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 5,
      "attack": 4,
      "health": 4,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 76,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考身材 4/4。源效果：战吼：对敌方英雄造成3点伤害。"
      },
      "sourceEffectText": "战吼：对敌方英雄造成3点伤害。",
      "effects": [
        {
          "clause": "战吼：对敌方英雄造成3点伤害。",
          "mechanisms": [
            "battlecry",
            "fixed_target_enemy_hero"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "fixed_target_enemy_hero"
      ],
      "name": "夜市叫阵客",
      "nameStatus": "candidate",
      "artBrief": "成年街头演员从画面左侧掀开小帘，把一枚醒目纸团投向右侧远景坐在店主椅上的对方代表人物；沿途其他站立角色不受影响，纸团落点用一枚集中墨花表示。演员无潜藏姿态。",
      "artSemantics": "历史参考费用 5。参考身材 4/4。源效果：战吼：对敌方英雄造成3点伤害。\n画面语义：战吼只对敌方英雄造成3点伤害，不能泛化为任意目标或敌方随从，也不新增潜行、连击或持续伤害。纸团只是一发效果隐喻。",
      "forbiddenRefs": "不借用原作刺客的族貌、夜刃武器、夜行装束或潜伏构图；原创街头叫阵演出与明确单一英雄目标。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry、fixed_target_enemy_hero",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-150",
      "sourceId": "VAN_CS2_150",
      "sourceRow": 77,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 5,
      "attack": 4,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 77,
        "column": "必保留语义",
        "text": "历史参考费用 5。参考身材 4/2。源效果：战吼：造成2点伤害。"
      },
      "sourceEffectText": "战吼：造成2点伤害。",
      "effects": [
        {
          "clause": "战吼：造成2点伤害。",
          "mechanisms": [
            "battlecry",
            "damage_single"
          ]
        }
      ],
      "requiredMechanisms": [
        "battlecry",
        "damage_single"
      ],
      "name": "软塞压筒客",
      "nameStatus": "candidate",
      "artBrief": "成年游艺摊挑战者握着一台宽口双握柄压筒，发出唯一一只较粗软塞；主角在左后，软塞和一次较大的墨点冲击占右前，场景只留木摊边框。压筒与单点伤害卡外形同属日常玩具但更厚重。",
      "artSemantics": "历史参考费用 5。参考身材 4/2。源效果：战吼：造成2点伤害。\n画面语义：战吼造成2点伤害，原文未限定目标阵营或类型；不画两发以免误读成两次1点，也不新增远程常驻武器。",
      "forbiddenRefs": "不借用原作族群、特种兵制服、雷矛标志、枪型或狙击构图；原创安全游艺压筒造型。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：battlecry",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-155",
      "sourceId": "VAN_CS2_155",
      "sourceRow": 78,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 6,
      "attack": 4,
      "health": 7,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 78,
        "column": "必保留语义",
        "text": "历史参考费用 6。参考身材 4/7。源效果：法术伤害+1"
      },
      "sourceEffectText": "法术伤害+1",
      "effects": [
        {
          "clause": "法术伤害+1",
          "mechanisms": [
            "spell_damage"
          ]
        }
      ],
      "requiredMechanisms": [
        "spell_damage"
      ],
      "name": "街区声纹导师",
      "nameStatus": "candidate",
      "artBrief": "一位年长成人站在宽阔声纹教学板旁，身形稳重，木架高过肩；一条细墨线经过导师手中的透明模板后变粗一档，板上其他位置留白。视觉重心为导师与高木架，增强标记保持与低费同类一致。",
      "artSemantics": "历史参考费用 6。参考身材 4/7。源效果：法术伤害+1\n画面语义：法术伤害仍只+1，不能因6费和导师地位暗示+2、额外抽牌或全体攻击增益；4/7身材独立保留。",
      "forbiddenRefs": "不借用原作大法师服饰、法杖、法术符号、人物身份或施法构图；原创街区教师和声纹教具。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：spell_damage",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-200",
      "sourceId": "VAN_CS2_200",
      "sourceRow": 79,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 6,
      "attack": 6,
      "health": 7,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 79,
        "column": "必保留语义",
        "text": "历史参考费用 6。参考身材 6/7。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "旧木搬运偶",
      "nameStatus": "candidate",
      "artBrief": "一个由宽木块和粗麻绳组成的高大活动搬运偶独自站在书店卸货区，双臂自然抱着空箱、脚板扎实；镜头仰视表现厚重体量，背景小门作为尺度参照，四肢关节清楚但不加金属齿轮。",
      "artSemantics": "历史参考费用 6。参考身材 6/7。源效果：（无效果）\n画面语义：无效果6/7随从；搬运、木质和高体量不产生抽牌、资源、嘲讽或机械标签。",
      "forbiddenRefs": "不借用原作食人魔的头、肤色、双拳比例、腰饰和姿态；原创木绳搭接结构及卸货区构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2200",
        "name": "旧木搬运偶",
        "type": "minion",
        "cost": 6,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 6,
        "health": 7
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 6,
          "health": 7,
          "manaSpent": 6
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-162",
      "sourceId": "VAN_CS2_162",
      "sourceRow": 80,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 6,
      "attack": 6,
      "health": 5,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 80,
        "column": "必保留语义",
        "text": "历史参考费用 6。参考身材 6/5。源效果：嘲讽"
      },
      "sourceEffectText": "嘲讽",
      "effects": [
        {
          "clause": "嘲讽",
          "mechanisms": [
            "keyword_taunt"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_taunt"
      ],
      "name": "展场压阵人",
      "nameStatus": "candidate",
      "artBrief": "成年大型展会布场员正面跨步站在通道中央，双手握住两块相接的轻木隔板；宽肩和隔板组成明显门形，身后暖灯下的展品只露轮廓。前景力量感强，人物本人仍清晰可见。",
      "artSemantics": "历史参考费用 6。参考身材 6/5。源效果：嘲讽\n画面语义：只保留嘲讽和6/5，不因展场身份增加竞技场、决斗、强制攻击或战吼规则。",
      "forbiddenRefs": "不借用原作竞技场人物、武器、重甲、标志性头盔或场馆构图；原创展会工作装与轻木隔板。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_taunt",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-213",
      "sourceId": "VAN_CS2_213",
      "sourceRow": 81,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 6,
      "attack": 5,
      "health": 2,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 81,
        "column": "必保留语义",
        "text": "历史参考费用 6。参考身材 5/2。源效果：冲锋"
      },
      "sourceEffectText": "冲锋",
      "effects": [
        {
          "clause": "冲锋",
          "mechanisms": [
            "keyword_charge"
          ]
        }
      ],
      "requiredMechanisms": [
        "keyword_charge"
      ],
      "name": "坡道弹板手",
      "nameStatus": "candidate",
      "artBrief": "成年滑行爱好者踩着弹性长板从高坡跃向前景，双臂展开、身体形成窄斜线，薄板和小轮完整可见；后景斜坡急速缩小，一条拉长的速度墨线强化强劲冲刺，装备没有喷口或燃烧。",
      "artSemantics": "历史参考费用 6。参考身材 5/2。源效果：冲锋\n画面语义：保留冲锋和5/2；不新增飞行、跳过嘲讽、爆炸伤害或自毁，弹板只是立即行动的视觉表达。",
      "forbiddenRefs": "不借用原作火箭背包、飞行头盔、爆破装备、人物族群或喷射构图；原创无动力长板与坡道。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：keyword_charge",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-201",
      "sourceId": "VAN_CS2_201",
      "sourceRow": 82,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从·野兽",
      "tribe": "beast",
      "cost": 7,
      "attack": 9,
      "health": 5,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 82,
        "column": "必保留语义",
        "text": "历史参考费用 7。参考身材 9/5。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "夜巷巨角鹿",
      "nameStatus": "candidate",
      "artBrief": "一头原创宽肩巨鹿停在夜市外侧，宽阔而不尖锐的枝状角伸展至画面两边；胸背紧实、腿部轻长，身体斜向镜头产生巨大冲击感。背景摊车缩小，角上无火焰、魔纹或发光装饰。",
      "artSemantics": "历史参考费用 7。参考身材 9/5。源效果：（无效果）\n画面语义：保留“随从·野兽”与无效果9/5；巨大角枝不带冲锋、嘲讽、范围伤害或火焰机制。",
      "forbiddenRefs": "不借用原作熔火犬、多头身体、熔岩皮肤、锁链及洞穴场景；原创单头鹿形、角枝和夜市尺度构图。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2201",
        "name": "夜巷巨角鹿",
        "type": "minion",
        "cost": 7,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 9,
        "health": 5
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 9,
          "health": 5,
          "manaSpent": 7
        }
      },
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-222",
      "sourceId": "VAN_CS2_222",
      "sourceRow": 83,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 7,
      "attack": 6,
      "health": 6,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 83,
        "column": "必保留语义",
        "text": "历史参考费用 7。参考身材 6/6。源效果：你的其他随从拥有+1/+1。"
      },
      "sourceEffectText": "你的其他随从拥有+1/+1。",
      "effects": [
        {
          "clause": "你的其他随从拥有+1/+1。",
          "mechanisms": [
            "aura",
            "buff"
          ]
        }
      ],
      "requiredMechanisms": [
        "aura",
        "buff"
      ],
      "name": "街坊撑场人",
      "nameStatus": "candidate",
      "artBrief": "成年社区联谊主持人居中举起素色布带，自己保持普通墨灰；同侧两位伙伴各在手边与胸前分别出现一枚尖角、一枚圆角缝章，敌侧无人获得标记。伙伴形成两翼但不遮住主体，画面温暖开阔。",
      "artSemantics": "历史参考费用 7。参考身材 6/6。源效果：你的其他随从拥有+1/+1。\n画面语义：你的其他随从持续拥有+1/+1，不影响自身、英雄或敌方，也不是登场后永久一次性加成。保留经典6/6，不使用对比列7/7。",
      "forbiddenRefs": "不借用原作城市名、勇士甲胄、阵营纹章、武器或英雄式原构图；原创社区主持人和双形缝章语言。",
      "artPriority": "P1 机制辨识优先",
      "implementationStatus": "unsupported",
      "statusReason": "需要原型尚未支持的机制：aura、buff",
      "runtimeDefinition": null,
      "expected": null,
      "ruleVerification": "not-verified-against-original"
    },
    {
      "id": "bk-van-cs2-186",
      "sourceId": "VAN_CS2_186",
      "sourceRow": 84,
      "class": "neutral",
      "classLabel": "中立",
      "hero": null,
      "type": "minion",
      "typeLabel": "随从",
      "tribe": null,
      "cost": 7,
      "attack": 7,
      "health": 7,
      "durability": null,
      "valueSource": {
        "file": "source-art-v1.csv",
        "sha256": "2d1dd6e004f896f12259f16511eff949e4348d7955641a5677dc9b8adc52edbd",
        "row": 84,
        "column": "必保留语义",
        "text": "历史参考费用 7。参考身材 7/7。源效果：（无效果）"
      },
      "sourceEffectText": "（无效果）",
      "effects": [
        {
          "clause": "（无效果）",
          "mechanisms": [
            "vanilla_minion"
          ]
        }
      ],
      "requiredMechanisms": [
        "vanilla_minion"
      ],
      "name": "压纸石像",
      "nameStatus": "candidate",
      "artBrief": "一尊由圆角石块与宽皮带组合的活动镇纸像站在大书店仓房中央，四肢粗短、胸腹方正，双手静置两侧；整身完整展示，脚边卷尺与普通纸箱作为尺寸参照。表面为暖灰石纹，没有火焰或金属核心。",
      "artSemantics": "历史参考费用 7。参考身材 7/7。源效果：（无效果）\n画面语义：无效果7/7随从；石像道具外观不自动获得机械、元素、嘲讽、护甲或其他规则标签。",
      "forbiddenRefs": "不借用原作作战傀儡的装甲、核心、头部、关节、配色或战斗构图；原创镇纸石块与皮带结合结构。",
      "artPriority": "P2 基础补齐",
      "implementationStatus": "supported",
      "statusReason": null,
      "runtimeDefinition": {
        "id": "bkVanCs2186",
        "name": "压纸石像",
        "type": "minion",
        "cost": 7,
        "text": "无特殊效果。",
        "art": "placeholder",
        "attack": 7,
        "health": 7
      },
      "expected": {
        "afterPlay": {
          "board": 1,
          "attack": 7,
          "health": 7,
          "manaSpent": 7
        }
      },
      "ruleVerification": "not-verified-against-original"
    }
  ]
};
