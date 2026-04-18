# 调音台功能设计文档

**日期：** 2026-04-18  
**项目：** 外文歌曲学唱 App  
**功能：** 麦克风调音台（监听 + 音调可视化 + 效果器 + 录音）

---

## 1. 功能概述

在歌曲播放页底部新增一个"调音台"抽屉面板，用户可以：

1. **麦克风监听** — 通过耳机实时听到自己的声音（带效果）
2. **实时可视化** — Canvas 显示实时音量条 + 音调走势曲线
3. **效果器** — 混响（ConvolverNode）+ 回声（DelayNode）音量滑块
4. **录音** — 使用 `getDisplayMedia` 捕获标签页音频（含 YouTube 音乐）与麦克风合流，录制为 `.webm` 文件后下载

---

## 2. 架构

### 新增文件

```
src/
  hooks/
    useAudioMixer.ts        # 封装整条 Web Audio 管线（核心逻辑）
  components/
    MixerDrawer.tsx         # 底部抽屉容器（开/关动画）
    MixerPanel.tsx          # 调音台 UI（滑块、按钮）
    PitchVisualizer.tsx     # Canvas 实时音量 + 音调走势图
```

### 修改文件

- `src/app/song/[id]/page.tsx` — 底部追加 `<MixerDrawer />`，无其他改动

---

## 3. Web Audio 管线

```
getUserMedia() ──→ MediaStreamSourceNode
                      ↓
                   GainNode              [mic volume, 0–1]
                      ↓
                   AnalyserNode          [→ PitchVisualizer]
                      ↓
              ┌───────┴───────┐
              ↓               ↓
         ConvolverNode    DelayNode      [reverb / echo，可独立开关]
              ↓               ↓
              └───────┬───────┘
                      ↓
          AudioContext.destination      [监听输出，默认关闭]
          MediaStreamDestinationNode   [合流给 MediaRecorder]

getDisplayMedia() → MediaStreamSourceNode
                      ↓
                   GainNode              [录音中音乐音量]
                      ↓
          MediaStreamDestinationNode   [合流给 MediaRecorder]

MediaStreamDestinationNode → MediaRecorder (audio/webm;codecs=opus) → .webm → 下载
```

**关键决策：**
- AudioContext 在用户点击打开抽屉时才创建（避免浏览器自动播放限制）
- 监听默认关闭，防止麦克风打开时立刻产生啸叫；UI 提示"建议戴耳机"
- `getDisplayMedia` 仅在用户点击"开始录音"时请求，不提前申请权限
- ConvolverNode 使用程序生成的合成脉冲响应（impulse response，无外部音频文件依赖），模拟 KTV 混响
- DelayNode 延迟时间固定为 300ms；`echoAmount` 滑块控制湿/干比例（wet/dry mix），不改变延迟时间

---

## 4. `useAudioMixer` Hook 接口

```ts
interface AudioMixerState {
  isOpen: boolean
  isMonitoring: boolean
  isRecording: boolean
  recordingTime: number      // 秒
  micVolume: number          // 0–1
  reverbAmount: number       // 0–1
  echoAmount: number         // 0–1
  analyserNode: AnalyserNode | null
  error: string | null
}

interface AudioMixerActions {
  openDrawer(): void
  closeDrawer(): void
  toggleMonitor(): void
  setMicVolume(v: number): void
  setReverb(v: number): void
  setEcho(v: number): void
  startRecording(): Promise<void>
  stopRecording(): void
}
```

内部持有的 Web Audio 节点均通过 `useRef` 存储，不触发 re-render。状态变化（音量值、录音时长等）通过 `useState` 驱动 UI 更新。

---

## 5. UI 组件

### MixerDrawer

- 歌曲页底部居中显示"🎛 调音台"按钮
- 点击后面板从底部以动画滑入（Tailwind `translate-y` transition）
- 面板顶部显示标题 + "建议戴耳机"警告 + 关闭按钮

### MixerPanel（三列布局）

| 左列：麦克风 | 中列：实时走势 | 右列：录音 |
|---|---|---|
| 音量滑块（0–100%）| Canvas 音调曲线 | 开始/停止录音按钮 |
| 混响滑块（0–100%）| 音量电平条 | 录音计时器（MM:SS）|
| 回声滑块（0–100%）| 当前音符 + dB 显示 | 下载按钮（录音后激活）|
| 监听开关按钮 | | |

### PitchVisualizer

- 通过 `requestAnimationFrame` 每帧轮询 `AnalyserNode`
- `getByteFrequencyData` → 绘制音量电平条
- `getFloatTimeDomainData` + autocorrelation 算法 → 估算基频 → 映射到音符名（C4、D#3 等）
- 绘制滚动音调折线图（最近 3 秒历史）

---

## 6. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 用户拒绝麦克风权限 | 抽屉仍可打开，显示"需要麦克风权限"提示，监听/效果/可视化控件禁用 |
| 用户拒绝 getDisplayMedia | 录音取消，按钮恢复初始状态，不崩溃 |
| 用户未勾选"共享标签页音频" | 录音继续（仅麦克风），完成后 toast 提示"录音未包含音乐" |
| AudioContext 被浏览器挂起 | `openDrawer()` 调用 `audioCtx.resume()` |
| 组件卸载时 AudioContext 未关闭 | `useEffect` cleanup 调用 `audioCtx.close()` |

---

## 7. 不在范围内

- 音调对比（与歌曲旋律比较）：LRC 文件无音高数据，暂不实现
- 服务端录音存储：录音仅本地下载，不上传
- 移动端适配：初版仅针对桌面浏览器
- 实时音高修正（Auto-Tune）：超出当前需求范围
