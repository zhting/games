# 果冻堆叠 / Jelly Stack

软体物理版俄罗斯方块：方块是 XPBD 果冻，没有网格吸附。填满一行只沿那一行的横带切开融化，方块剩下的部分会继续掉下去，而不是整块消失。

## 本地运行

任意静态服务器即可，例如：

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

浏览器打开提示的地址（需支持 **WebGL2**）。

## 操作

| 键 | 作用 |
|---|---|
| `A` / `D` | 左右推 |
| `S` | 下推 |
| `W` / `X` | 旋转 |
| `Z` | 反向旋转 |
| `Space` | 硬降 |
| `P` / `Esc` | 暂停 |
| `R` | 重开 |

手机：左下左右移，右下旋转/下移；右上角可暂停。

## 说明

灵感来自 Soft Matter / [scottstts/Jelly-Baby](https://github.com/scottstts/Jelly-Baby) 的软体与折射思路；本仓库为可玩的果冻方块单页实现。
