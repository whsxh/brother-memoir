# 兄弟回忆录

一个可以自己往里塞东西的回忆网页：文字、照片、视频三块，全部支持上传和编辑，内容存在 GitHub 仓库里，换台电脑打开也是最新的。

## 怎么用

打开页面 → 右上角 **⚙** → 填：

| 字段 | 填什么 |
|---|---|
| 仓库所有者 | 你的 GitHub 用户名 |
| 仓库名 | `brother-memoir` |
| 分支 | `main` |
| 访问令牌 | 见下方「怎么拿令牌」 |

填完保存，右上角会显示「已同步」，之后：

- 点 **编辑模式** → 文字直接点开改，照片/视频点右上「删除」，加内容点各区的按钮
- 改完自动提交到仓库（约 1 秒后生效）
- 没填令牌时只存在本机浏览器，方便先看效果，但换设备就没了

## 怎么拿令牌

1. 打开 https://github.com/settings/personal-access-tokens/new
2. Token name 随便写，Expiration 选你喜欢的期限
3. **Repository access** → Only select repositories → 勾 `brother-memoir`
4. **Permissions** → Repository permissions → 找到 **Contents** → 选 **Read and write**
5. 生成后复制 `github_pat_...` 开头的字符串，粘进页面的 ⚙ 里

令牌只保存在你自己的浏览器 localStorage，不会发给任何第三方。

## 存储结构

```
index.html        页面
styles.css        样式
app.js            逻辑
data/memoir.json  所有文字与媒体索引（自动生成）
media/            上传的照片和视频
```

## 限制

- 单个文件 GitHub 限制 100 MB，页面里拦住超过 45 MB 的视频
- 照片会自动压缩到长边 1800px，省仓库空间
- GitHub Pages 站点总量建议控制在 1 GB 以内
- 大视频请用「＋ 加外链」，填 B 站播放器地址或 mp4 直链
