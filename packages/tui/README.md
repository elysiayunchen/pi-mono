# @elynyx/tui

轻量级终端 UI 框架，支持差异渲染和同步输出，实现无闪烁的交互式 CLI 应用。

## 特性

- **差异渲染**：三策略渲染系统，仅更新变化部分
- **同步输出**：使用 CSI 2026 实现原子性屏幕更新（无闪烁）
- **括号粘贴模式**：正确处理大量粘贴，超过 10 行时添加标记
- **组件化**：简洁的 Component 接口，包含 `render()` 方法
- **主题支持**：组件接受主题接口以实现自定义样式
- **内置组件**：Text、TruncatedText、Input、Editor、Markdown、Loader、SelectList、SettingsList、Spacer、Image、Box、Container
- **内联图片**：在支持 Kitty 或 iTerm2 图形协议的终端中渲染图片
- **自动补全**：支持文件路径和斜杠命令

## 快速开始

```typescript
import { TUI, Text, Editor, ProcessTerminal } from "@elynyx/tui";

// 创建终端
const terminal = new ProcessTerminal();

// 创建 TUI
const tui = new TUI(terminal);

// 添加组件
tui.addChild(new Text("欢迎使用我的应用！"));

const editor = new Editor(tui, editorTheme);
editor.onSubmit = (text) => {
  console.log("已提交:", text);
  tui.addChild(new Text(`你说: ${text}`));
};
tui.addChild(editor);

// 启动
tui.start();
```

## 核心 API

### TUI

管理组件和渲染的主容器。

```typescript
const tui = new TUI(terminal);
tui.addChild(component);       // 添加组件
tui.removeChild(component);    // 移除组件
tui.start();                   // 启动
tui.stop();                    // 停止
tui.requestRender();           // 请求重新渲染

// 全局调试快捷键处理（Shift+Ctrl+D）
tui.onDebug = () => console.log("调试已触发");
```

### 叠加层（Overlays）

叠加层在现有内容之上渲染组件，不会替换原有内容。适用于对话框、菜单和模态 UI。

```typescript
// 使用默认选项显示叠加层（居中，最大 80 列）
const handle = tui.showOverlay(component);

// 使用自定义定位和尺寸显示叠加层
// 值可以是数字（绝对值）或百分比字符串（如 "50%"）
const handle = tui.showOverlay(component, {
  // 尺寸
  width: 60,              // 固定宽度（列数）
  width: "80%",           // 相对于终端宽度的百分比
  minWidth: 40,           // 最小宽度下限
  maxHeight: 20,          // 最大高度（行数）
  maxHeight: "50%",       // 相对于终端高度的百分比

  // 基于锚点的定位（默认: 'center'）
  anchor: 'bottom-right', // 相对于锚点的位置
  offsetX: 2,             // 水平偏移量
  offsetY: -1,            // 垂直偏移量

  // 基于百分比的定位（替代锚点定位）
  row: "25%",             // 垂直位置（0%=顶部, 100%=底部）
  col: "50%",             // 水平位置（0%=左侧, 100%=右侧）

  // 绝对定位（覆盖锚点/百分比定位）
  row: 5,                 // 精确行位置
  col: 10,                // 精确列位置

  // 距终端边缘的边距
  margin: 2,              // 四边相同
  margin: { top: 1, right: 2, bottom: 1, left: 2 }, // 分别设置

  // 响应式可见性
  visible: (termWidth, termHeight) => termWidth >= 100  // 窄终端时隐藏

  // 焦点行为
  nonCapturing: true       // 显示时不自动获取焦点
});

// OverlayHandle 方法
handle.hide();              // 永久移除叠加层
handle.setHidden(true);     // 临时隐藏（可重新显示）
handle.setHidden(false);    // 隐藏后重新显示
handle.isHidden();          // 检查是否临时隐藏
handle.focus();             // 获取焦点并移至视觉顶层
handle.unfocus();           // 释放焦点给前一个目标
handle.isFocused();         // 检查叠加层是否拥有焦点

// 隐藏最顶层叠加层
tui.hideOverlay();

// 检查是否有可见的叠加层处于活动状态
tui.hasOverlay();
```

**锚点值**：`'center'`、`'top-left'`、`'top-right'`、`'bottom-left'`、`'bottom-right'`、`'top-center'`、`'bottom-center'`、`'left-center'`、`'right-center'`

**解析优先级**：
1. `minWidth` 在宽度计算后作为下限应用
2. 定位方式：绝对 `row`/`col` > 百分比 `row`/`col` > `anchor`
3. `margin` 将最终位置限制在终端边界内
4. `visible` 回调控制叠加层是否渲染（每帧调用）

### Component 接口

所有组件均实现：

```typescript
interface Component {
  render(width: number): string[];   // 渲染
  handleInput?(data: string): void;  // 处理输入
  invalidate?(): void;               // 使缓存失效
}
```

| 方法 | 描述 |
|------|------|
| `render(width)` | 返回一个字符串数组，每行一个字符串。每行**不得超过 `width`**，否则 TUI 会报错。使用 `truncateToWidth()` 或手动换行来确保此约束。 |
| `handleInput?(data)` | 当组件拥有焦点并接收到键盘输入时调用。`data` 字符串包含原始终端输入（可能包含 ANSI 转义序列）。 |
| `invalidate?()` | 调用以清除已缓存的渲染状态。组件应在下次 `render()` 调用时从头重新渲染。 |

TUI 在每行渲染末尾追加完整的 SGR 重置和 OSC 8 重置。样式不会跨行传递。如果发出带样式的多行文本，请在每行重新应用样式，或使用 `wrapTextWithAnsi()` 以确保样式在换行后保留。

### Focusable 接口（输入法支持）

显示文本光标且需要 IME（输入法编辑器）支持的组件应实现 `Focusable` 接口：

```typescript
import { CURSOR_MARKER, type Component, type Focusable } from "@elynyx/tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // 焦点变化时由 TUI 设置

  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    // 在伪光标前发出标记
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

当 `Focusable` 组件拥有焦点时，TUI：
1. 将 `focused = true` 设置到组件上
2. 扫描渲染输出中的 `CURSOR_MARKER`（零宽度 APC 转义序列）
3. 将硬件终端光标定位到该位置
4. 显示硬件光标

这使得 IME 候选窗口能在正确位置显示，适用于中日韩等输入法。`Editor` 和 `Input` 内置组件已实现此接口。

**包含内嵌输入的容器组件：** 当容器组件（对话框、选择器等）包含 `Input` 或 `Editor` 子组件时，容器必须实现 `Focusable` 并将焦点状态传播给子组件：

```typescript
import { Container, type Focusable, Input } from "@elynyx/tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // 将焦点传播给子输入组件以正确定位 IME 光标
  private _focused = false;
  get focused(): boolean { return this._focused; }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

如果不进行此传播，使用 IME（中文、日文、韩文等）输入时候选窗口将出现在错误位置。

## 内置组件

### Container

组合子组件的容器。

```typescript
const container = new Container();
container.addChild(component);    // 添加子组件
container.removeChild(component); // 移除子组件
```

### Box

对所有子组件应用内边距和背景色的容器。

```typescript
const box = new Box(
  1,                              // paddingX（默认: 1）
  1,                              // paddingY（默认: 1）
  (text) => chalk.bgGray(text)   // 可选的背景函数
);
box.addChild(new Text("内容"));
box.setBgFn((text) => chalk.bgBlue(text));  // 动态更改背景
```

### Text

显示支持自动换行和内边距的多行文本。

```typescript
const text = new Text(
  "你好世界",                      // 文本内容
  1,                              // paddingX（默认: 1）
  1,                              // paddingY（默认: 1）
  (text) => chalk.bgGray(text)   // 可选的背景函数
);
text.setText("更新后的文本");
text.setCustomBgFn((text) => chalk.bgBlue(text));
```

### TruncatedText

截断以适配视口宽度的单行文本。适用于状态栏和标题。

```typescript
const truncated = new TruncatedText(
  "这是一段很长的文本，将会被截断...",
  0,  // paddingX（默认: 0）
  0   // paddingY（默认: 0）
);
```

### Input

支持水平滚动的单行文本输入。

```typescript
const input = new Input();
input.onSubmit = (value) => console.log(value);
input.setValue("初始值");
input.getValue();
```

**快捷键：**
- `Enter` - 提交
- `Ctrl+A` / `Ctrl+E` - 行首/行尾
- `Ctrl+W` 或 `Alt+Backspace` - 向前删除一个单词
- `Ctrl+U` - 删除到行首
- `Ctrl+K` - 删除到行尾
- `Ctrl+Left` / `Ctrl+Right` - 按单词导航
- `Alt+Left` / `Alt+Right` - 按单词导航
- 方向键、退格键、删除键正常工作

### Editor

支持自动补全、文件路径补全、粘贴处理的多行文本编辑器，当内容超过终端高度时自动垂直滚动。

```typescript
interface EditorTheme {
  borderColor: (str: string) => string;       // 边框颜色
  selectList: SelectListTheme;                // 选择列表主题
}

interface EditorOptions {
  paddingX?: number;  // 水平内边距（默认: 0）
}

const editor = new Editor(tui, theme, options?);  // tui 用于感知高度的滚动
editor.onSubmit = (text) => console.log(text);     // 提交回调
editor.onChange = (text) => console.log("已更改:", text); // 变更回调
editor.disableSubmit = true;                       // 临时禁用提交
editor.setAutocompleteProvider(provider);          // 设置自动补全提供器
editor.borderColor = (s) => chalk.blue(s);         // 动态更改边框颜色
editor.setPaddingX(1);                             // 动态更新水平内边距
editor.getPaddingX();                              // 获取当前内边距
```

**功能特性：**
- 支持自动换行的多行编辑
- 斜杠命令自动补全（输入 `/`）
- 文件路径自动补全（按 `Tab`）
- 大段粘贴处理（超过 10 行时创建 `[paste #1 +50 lines]` 标记）
- 编辑器上下水平分隔线
- 伪光标渲染（隐藏真实光标）

**快捷键：**
- `Enter` - 提交
- `Shift+Enter`、`Ctrl+Enter` 或 `Alt+Enter` - 换行（取决于终端，`Alt+Enter` 最可靠）
- `Tab` - 自动补全
- `Ctrl+K` - 删除到行尾
- `Ctrl+U` - 删除到行首
- `Ctrl+W` 或 `Alt+Backspace` - 向前删除一个单词
- `Alt+D` 或 `Alt+Delete` - 向后删除一个单词
- `Ctrl+A` / `Ctrl+E` - 行首/行尾
- `Ctrl+]` - 向前跳转到指定字符（等待下一次按键，然后将光标移至首个匹配位置）
- `Ctrl+Alt+]` - 向后跳转到指定字符
- 方向键、退格键、删除键正常工作

### Markdown

支持语法高亮和主题的 Markdown 渲染器。

```typescript
interface MarkdownTheme {
  heading: (text: string) => string;          // 标题
  link: (text: string) => string;             // 链接文本
  linkUrl: (text: string) => string;          // 链接地址
  code: (text: string) => string;             // 行内代码
  codeBlock: (text: string) => string;        // 代码块
  codeBlockBorder: (text: string) => string;  // 代码块边框
  quote: (text: string) => string;            // 引用
  quoteBorder: (text: string) => string;      // 引用边框
  hr: (text: string) => string;               // 水平分隔线
  listBullet: (text: string) => string;       // 列表标记
  bold: (text: string) => string;             // 粗体
  italic: (text: string) => string;           // 斜体
  strikethrough: (text: string) => string;    // 删除线
  underline: (text: string) => string;        // 下划线
  highlightCode?: (code: string, lang?: string) => string[]; // 代码高亮
}

interface DefaultTextStyle {
  color?: (text: string) => string;     // 文本颜色
  bgColor?: (text: string) => string;   // 背景颜色
  bold?: boolean;                       // 粗体
  italic?: boolean;                     // 斜体
  strikethrough?: boolean;              // 删除线
  underline?: boolean;                  // 下划线
}

const md = new Markdown(
  "# 你好\n\n一些**粗体**文本",
  1,              // paddingX
  1,              // paddingY
  theme,          // MarkdownTheme
  defaultStyle    // 可选的 DefaultTextStyle
);
md.setText("更新后的 markdown");
```

**功能特性：**
- 标题、粗体、斜体、代码块、列表、链接、引用块
- HTML 标签以纯文本渲染
- 可选的语法高亮（通过 `highlightCode`）
- 内边距支持
- 渲染缓存以优化性能

### Loader

带动画的加载指示器。

```typescript
const loader = new Loader(
  tui,                              // TUI 实例用于触发渲染更新
  (s) => chalk.cyan(s),            // 旋转指示器颜色函数
  (s) => chalk.gray(s),            // 消息文本颜色函数
  "加载中..."                       // 消息文本（默认: "Loading..."）
);
loader.start();                     // 开始
loader.setMessage("仍在加载...");    // 更新消息
loader.stop();                      // 停止
```

### CancellableLoader

扩展 Loader，支持 Escape 键处理和 AbortSignal 用于取消异步操作。

```typescript
const loader = new CancellableLoader(
  tui,                              // TUI 实例用于触发渲染更新
  (s) => chalk.cyan(s),            // 旋转指示器颜色函数
  (s) => chalk.gray(s),            // 消息文本颜色函数
  "处理中..."                       // 消息文本
);
loader.onAbort = () => done(null);  // 用户按下 Escape 时调用
doAsyncWork(loader.signal).then(done);
```

**属性：**
- `signal: AbortSignal` - 用户按下 Escape 时中止
- `aborted: boolean` - 是否已被中止
- `onAbort?: () => void` - 中止时的回调

### SelectList

支持键盘导航的交互式选择列表。

```typescript
interface SelectItem {
  value: string;            // 值
  label: string;            // 显示标签
  description?: string;     // 描述
}

interface SelectListTheme {
  selectedPrefix: (text: string) => string;   // 选中项前缀
  selectedText: (text: string) => string;     // 选中项文本
  description: (text: string) => string;      // 描述文本
  scrollInfo: (text: string) => string;       // 滚动信息
  noMatch: (text: string) => string;          // 无匹配提示
}

const list = new SelectList(
  [
    { value: "opt1", label: "选项 1", description: "第一个选项" },
    { value: "opt2", label: "选项 2", description: "第二个选项" },
  ],
  5,      // 最大可见数量
  theme   // SelectListTheme
);

list.onSelect = (item) => console.log("已选择:", item);       // 选择回调
list.onCancel = () => console.log("已取消");                   // 取消回调
list.onSelectionChange = (item) => console.log("高亮:", item); // 高亮变化回调
list.setFilter("opt"); // 过滤项
```

**操作方式：**
- 方向键：导航
- Enter：选择
- Escape：取消

### SettingsList

支持值切换和子菜单的设置面板。

```typescript
interface SettingItem {
  id: string;                               // 设置项 ID
  label: string;                            // 显示标签
  description?: string;                     // 描述
  currentValue: string;                     // 当前值
  values?: string[];                        // 可选值列表，Enter/Space 在其中循环
  submenu?: (currentValue: string, done: (selectedValue?: string) => void) => Component; // 子菜单
}

interface SettingsListTheme {
  label: (text: string, selected: boolean) => string;   // 标签样式
  value: (text: string, selected: boolean) => string;   // 值样式
  description: (text: string) => string;                // 描述样式
  cursor: string;                                       // 光标字符
  hint: (text: string) => string;                       // 提示文本
}

const settings = new SettingsList(
  [
    { id: "theme", label: "主题", currentValue: "dark", values: ["dark", "light"] },
    { id: "model", label: "模型", currentValue: "gpt-4", submenu: (val, done) => modelSelector },
  ],
  10,      // 最大可见数量
  theme,   // SettingsListTheme
  (id, newValue) => console.log(`${id} 已更改为 ${newValue}`), // 值变更回调
  () => console.log("已取消")                                   // 取消回调
);
settings.updateValue("theme", "light"); // 更新设置值
```

**操作方式：**
- 方向键：导航
- Enter/Space：激活（循环值或打开子菜单）
- Escape：取消

### Spacer

用于垂直间距的空行。

```typescript
const spacer = new Spacer(2); // 2 个空行（默认: 1）
```

### Image

在支持 Kitty 图形协议（Kitty、Ghostty、WezTerm）或 iTerm2 内联图片的终端中渲染内联图片。在不支持的终端上回退为文本占位符。

```typescript
interface ImageTheme {
  fallbackColor: (str: string) => string;  // 回退文本颜色
}

interface ImageOptions {
  maxWidthCells?: number;    // 最大宽度（单元格数）
  maxHeightCells?: number;   // 最大高度（单元格数）
  filename?: string;         // 文件名
}

const image = new Image(
  base64Data,       // base64 编码的图片数据
  "image/png",      // MIME 类型
  theme,            // ImageTheme
  options           // 可选的 ImageOptions
);
tui.addChild(image);
```

支持格式：PNG、JPEG、GIF、WebP。尺寸会自动从图片头部解析。

## 自动补全

### CombinedAutocompleteProvider

同时支持斜杠命令和文件路径。

```typescript
import { CombinedAutocompleteProvider } from "@elynyx/tui";

const provider = new CombinedAutocompleteProvider(
  [
    { name: "help", description: "显示帮助" },
    { name: "clear", description: "清屏" },
    { name: "delete", description: "删除最后一条消息" },
  ],
  process.cwd() // 文件补全的基础路径
);

editor.setAutocompleteProvider(provider);
```

**功能特性：**
- 输入 `/` 显示斜杠命令
- 按 `Tab` 进行文件路径补全
- 支持 `~/`、`./`、`../` 和 `@` 前缀
- `@` 前缀会过滤为可附加的文件

## 按键检测

使用 `matchesKey()` 配合 `Key` 辅助工具检测键盘输入（支持 Kitty 键盘协议）：

```typescript
import { matchesKey, Key } from "@elynyx/tui";

if (matchesKey(data, Key.ctrl("c"))) {
  process.exit(0);
}

if (matchesKey(data, Key.enter)) {
  submit();
} else if (matchesKey(data, Key.escape)) {
  cancel();
} else if (matchesKey(data, Key.up)) {
  moveUp();
}
```

**按键标识符**（使用 `Key.*` 获得自动补全，或使用字符串字面量）：
- 基本按键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
- 方向键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
- 带修饰键：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
- 字符串格式同样可用：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

## 差异渲染

TUI 使用三种渲染策略：

1. **首次渲染**：输出所有行，不清除滚动缓冲区
2. **宽度变化或视口上方有变更**：清屏并完全重新渲染
3. **普通更新**：将光标移至首个变更行，清除至行尾，渲染变更行

所有更新均包裹在**同步输出**中（`\x1b[?2026h` ... `\x1b[?2026l`），实现原子性、无闪烁渲染。

## 终端接口

TUI 可与任何实现 `Terminal` 接口的对象配合使用：

```typescript
interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void; // 启动
  stop(): void;               // 停止
  write(data: string): void;  // 写入数据
  get columns(): number;      // 列数
  get rows(): number;         // 行数
  moveBy(lines: number): void;   // 移动光标
  hideCursor(): void;            // 隐藏光标
  showCursor(): void;            // 显示光标
  clearLine(): void;             // 清除当前行
  clearFromCursor(): void;       // 从光标处清除
  clearScreen(): void;           // 清屏
}
```

**内置实现：**
- `ProcessTerminal` - 使用 `process.stdin/stdout`
- `VirtualTerminal` - 用于测试（使用 `@xterm/headless`）

## 工具函数

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@elynyx/tui";

// 获取字符串的可见宽度（忽略 ANSI 代码）
const width = visibleWidth("\x1b[31m你好\x1b[0m"); // 2

// 截断字符串到指定宽度（保留 ANSI 代码，添加省略号）
const truncated = truncateToWidth("你好世界欢迎光临", 8); // "你好世界..."

// 不带省略号截断
const truncatedNoEllipsis = truncateToWidth("你好世界欢迎光临", 8, ""); // "你好世界欢迎光"

// 自动换行（在换行处保留 ANSI 代码）
const lines = wrapTextWithAnsi("这是一段很长的文本需要换行处理", 10);
// ["这是一段很长的", "文本需要换行处理"]
```

## 创建自定义组件

创建自定义组件时，**`render()` 返回的每行不得超过 `width` 参数**。如果任何行超过终端宽度，TUI 将报错。

### 处理输入

使用 `matchesKey()` 配合 `Key` 辅助工具处理键盘输入：

```typescript
import { matchesKey, Key, truncateToWidth } from "@elynyx/tui";
import type { Component } from "@elynyx/tui";

class MyInteractiveComponent implements Component {
  private selectedIndex = 0;
  private items = ["选项 1", "选项 2", "选项 3"];

  public onSelect?: (index: number) => void;
  public onCancel?: () => void;

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.selectedIndex);
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    return this.items.map((item, i) => {
      const prefix = i === this.selectedIndex ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
  }
}
```

### 处理行宽

使用提供的工具函数确保行宽合适：

```typescript
import { visibleWidth, truncateToWidth } from "@elynyx/tui";
import type { Component } from "@elynyx/tui";

class MyComponent implements Component {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(width: number): string[] {
    // 方式 1：截断过长的行
    return [truncateToWidth(this.text, width)];

    // 方式 2：检查并填充到精确宽度
    const line = this.text;
    const visible = visibleWidth(line);
    if (visible > width) {
      return [truncateToWidth(line, width)];
    }
    // 填充到精确宽度（可选，用于背景色）
    return [line + " ".repeat(width - visible)];
  }
}
```

### ANSI 代码注意事项

`visibleWidth()` 和 `truncateToWidth()` 均正确处理 ANSI 转义代码：

- `visibleWidth()` 在计算宽度时忽略 ANSI 代码
- `truncateToWidth()` 保留 ANSI 代码，并在截断时正确关闭它们

```typescript
import chalk from "chalk";

const styled = chalk.red("你好") + " " + chalk.blue("世界");
const width = visibleWidth(styled); // 5（不计算 ANSI 代码）
const truncated = truncateToWidth(styled, 4); // 红色 "你好" + "..." 带正确的重置码
```

### 缓存

为优化性能，组件应缓存渲染输出，仅在必要时重新渲染：

```typescript
class CachedComponent implements Component {
  private text: string;
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = [truncateToWidth(this.text, width)];

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

## 示例

参见 `test/chat-simple.ts` 获取完整的聊天界面示例，包含：
- 带自定义背景色的 Markdown 消息
- 响应期间的加载动画
- 带自动补全和斜杠命令的编辑器
- 消息间的间距

运行方式：
```bash
npx tsx test/chat-simple.ts
```

## 开发

```bash
# 安装依赖（从 monorepo 根目录）
npm install

# 运行类型检查
npm run check

# 运行示例
npx tsx test/chat-simple.ts
```

### 调试日志

设置 `PI_TUI_WRITE_LOG` 环境变量以捕获写入 stdout 的原始 ANSI 流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log npx tsx test/chat-simple.ts
```