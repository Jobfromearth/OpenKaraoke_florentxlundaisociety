'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface AudioNodes {
  ctx: AudioContext
  micStream: MediaStream
  micGain: GainNode
  analyser: AnalyserNode
  dryGain: GainNode
  convolver: ConvolverNode
  reverbGain: GainNode
  delay: DelayNode
  echoGain: GainNode
  sumGain: GainNode
  monitorGain: GainNode
  recDest: MediaStreamAudioDestinationNode
}

function createImpulseResponse(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const ch = impulse.getChannelData(c)
    for (let i = 0; i < length; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
    }
  }
  return impulse
}

async function buildPipeline(micStream: MediaStream): Promise<AudioNodes> {
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()

  const micSource = ctx.createMediaStreamSource(micStream)
  const micGain = ctx.createGain()
  micGain.gain.value = 0.75

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048

  const dryGain = ctx.createGain()
  dryGain.gain.value = 1

  const convolver = ctx.createConvolver()
  convolver.buffer = createImpulseResponse(ctx)
  const reverbGain = ctx.createGain()
  reverbGain.gain.value = 0

  const delay = ctx.createDelay(1.0)
  delay.delayTime.value = 0.3
  const echoGain = ctx.createGain()
  echoGain.gain.value = 0

  const sumGain = ctx.createGain()
  sumGain.gain.value = 1

  const monitorGain = ctx.createGain()
  monitorGain.gain.value = 0   // off by default — prevents feedback without headphones

  const recDest = ctx.createMediaStreamDestination()

  micSource.connect(micGain)
  micGain.connect(analyser)
  analyser.connect(dryGain)
  analyser.connect(convolver)
  convolver.connect(reverbGain)
  analyser.connect(delay)
  delay.connect(echoGain)
  dryGain.connect(sumGain)
  reverbGain.connect(sumGain)
  echoGain.connect(sumGain)
  sumGain.connect(monitorGain)
  monitorGain.connect(ctx.destination)
  sumGain.connect(recDest)

  return { ctx, micStream, micGain, analyser, dryGain, convolver, reverbGain, delay, echoGain, sumGain, monitorGain, recDest }
}

export function useAudioMixer() {
  const nodesRef = useRef<AudioNodes | null>(null)
  const buildingRef = useRef(false)
  const recordingStartingRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingBlobRef = useRef<Blob | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const displaySourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const displayGainRef = useRef<GainNode | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micVolume, setMicVolumeState] = useState(0.75)
  const [reverbAmount, setReverbAmountState] = useState(0)
  const [echoAmount, setEchoAmountState] = useState(0)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasRecording, setHasRecording] = useState(false)

  const openDrawer = useCallback(async () => {
    setIsOpen(true)
    if (nodesRef.current) { await nodesRef.current.ctx.resume(); return }
    if (buildingRef.current) return
    buildingRef.current = true
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const nodes = await buildPipeline(micStream)
      nodesRef.current = nodes
      setAnalyserNode(nodes.analyser)
      setError(null)
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setError(name === 'NotFoundError' ? '未检测到麦克风设备' : '需要麦克风权限')
    } finally {
      buildingRef.current = false
    }
  }, [])

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
    nodesRef.current?.ctx.suspend()
  }, [])

  const toggleMonitor = useCallback(() => {
    setIsMonitoring(prev => {
      const next = !prev
      if (nodesRef.current) nodesRef.current.monitorGain.gain.value = next ? 1 : 0
      return next
    })
  }, [])

  const setMicVolume = useCallback((v: number) => {
    setMicVolumeState(v)
    if (nodesRef.current) nodesRef.current.micGain.gain.value = v
  }, [])

  const setReverb = useCallback((v: number) => {
    setReverbAmountState(v)
    if (nodesRef.current) nodesRef.current.reverbGain.gain.value = v
  }, [])

  const setEcho = useCallback((v: number) => {
    setEchoAmountState(v)
    if (nodesRef.current) nodesRef.current.echoGain.gain.value = v
  }, [])

  const startRecording = useCallback(async () => {
    if (!nodesRef.current) return
    if (recordingStartingRef.current) return
    recordingStartingRef.current = true
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true })
      displayStreamRef.current = displayStream

      const { ctx, recDest } = nodesRef.current
      const displaySource = ctx.createMediaStreamSource(displayStream)
      displaySourceRef.current = displaySource
      const displayGain = ctx.createGain()
      displayGainRef.current = displayGain
      displayGain.gain.value = 1
      displaySource.connect(displayGain)
      displayGain.connect(recDest)

      const hasAudio = displayStream.getAudioTracks().length > 0
      chunksRef.current = []
      recordingBlobRef.current = null
      setHasRecording(false)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(recDest.stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        recordingBlobRef.current = blob
        setHasRecording(true)
        if (!hasAudio) setError('录音未包含音乐（未选择共享标签页音频）')
      }

      recorder.start()
      recordingStartingRef.current = false
      recorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      recordingStartingRef.current = false
      // user cancelled getDisplayMedia — do nothing
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    recorderRef.current?.stop()
    displayGainRef.current?.disconnect()
    displaySourceRef.current?.disconnect()
    displayGainRef.current = null
    displaySourceRef.current = null
    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current = null
    recorderRef.current = null
    setIsRecording(false)
  }, [])

  const downloadRecording = useCallback(() => {
    if (!recordingBlobRef.current) return
    const url = URL.createObjectURL(recordingBlobRef.current)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      nodesRef.current?.micStream.getTracks().forEach(t => t.stop())
      nodesRef.current?.ctx.close()
    }
  }, [])

  return {
    isOpen, isMonitoring, isRecording, recordingTime,
    micVolume, reverbAmount, echoAmount,
    analyserNode, error, hasRecording,
    openDrawer, closeDrawer, toggleMonitor,
    setMicVolume, setReverb, setEcho,
    startRecording, stopRecording, downloadRecording,
  }
}
