"use client";

import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";

import "./threads.css";

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uPulse;

#define PI 3.1415926538

// === 9 faders: x-position (0-1), knob center Y (0-1), knob height (0-1) ===
// Positions derived from atto-app Logo.tsx (9 faders, circle R=116)
const int FADER_COUNT = 9;

vec3 getFader(int i) {
    // Returns vec3(xPos, knobCenterY, knobHalfHeight)
    // Faders 0 and 8 are extreme (static, no pulse)
    if (i == 0) return vec3(0.259, 0.648, 0.246);
    if (i == 1) return vec3(0.318, 0.557, 0.081);
    if (i == 2) return vec3(0.376, 0.581, 0.229);
    if (i == 3) return vec3(0.434, 0.500, 0.314);
    if (i == 4) return vec3(0.500, 0.430, 0.339);
    if (i == 5) return vec3(0.566, 0.529, 0.298);
    if (i == 6) return vec3(0.624, 0.589, 0.237);
    if (i == 7) return vec3(0.682, 0.557, 0.081);
    return         vec3(0.741, 0.648, 0.246);
}

float pixel(float count, vec2 resolution) {
    return (1.0 / max(resolution.x, resolution.y)) * count;
}

// SDF capsule: distance from point p to line segment a→b, with radius r
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// Draw all 9 faders as SDF shapes with heartbeat pulse, clipped to a circle
float drawFaders(vec2 uv, float pulse, float time) {
    float aspect = iResolution.x / iResolution.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.60);

    float pulseScale = 1.0 + pulse * 0.07;
    float result = 0.0;
    float px = pixel(1.0, iResolution.xy);

    // Uniform scale factor — shrinks the entire logo proportionally
    float logoScale = 0.80;

    // Decoupled X/Y scales: X pushes outer faders to circle edge for
    // crescent clipping; Y keeps capsules short enough for visible stems.
    float xScale = 0.88 * logoScale;
    float yScale = 0.42 * logoScale;
    float circleRadius = 0.24 * logoScale;

    for (int i = 0; i < FADER_COUNT; i++) {
        vec3 fader = getFader(i);
        float fx = (fader.x - 0.5) * xScale;
        float fy = (fader.y - 0.5) * yScale;
        float thisPulse = (i > 0 && i < FADER_COUNT - 1) ? pulseScale : 1.0;
        float kh = fader.z * yScale * thisPulse;

        // Thin stem
        float stemWidth = 0.0015 * logoScale;
        float stemDist = abs(p.x - fx) - stemWidth;
        float stemAlpha = smoothstep(px, 0.0, stemDist) * 0.55;

        // Capsule knob
        vec2 knobTop = vec2(fx, fy + kh);
        vec2 knobBot = vec2(fx, fy - kh);
        float knobRadius = 0.016 * logoScale * thisPulse;
        float knobDist = sdCapsule(p, knobBot, knobTop, knobRadius);
        float knobAlpha = smoothstep(px, -px, knobDist);

        result = max(result, max(stemAlpha, knobAlpha));
    }

    // Circular clipping mask
    float circleDist = length(p);
    float circleMask = smoothstep(px, -px, circleDist - circleRadius);
    result *= circleMask;

    return result;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float fadersVal = drawFaders(uv, uPulse, iTime);
    fragColor = vec4(uColor * fadersVal, fadersVal);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

// Realistic heartbeat: two gaussian bumps (lub-dub) per cycle
function computeHeartbeat(timeSeconds: number): number {
  const cycle = timeSeconds % 1.2;
  const b1 = Math.exp(-Math.pow((cycle - 0.15) * 10, 2));
  const b2 = Math.exp(-Math.pow((cycle - 0.35) * 10, 2)) * 0.6;
  return b1 + b2;
}

interface ThreadsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
  color?: [number, number, number];
  enableMouseInteraction?: boolean;
}

export default function Threads({
  color = [1, 1, 1],
  enableMouseInteraction = false,
  ...rest
}: ThreadsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const renderer = new Renderer({ alpha: true, dpr });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    container.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height
          ),
        },
        uColor: { value: new Color(...color) },
        uPulse: { value: 0 },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      const w = gl.canvas.width;
      const h = gl.canvas.height;
      program.uniforms.iResolution.value.r = w;
      program.uniforms.iResolution.value.g = h;
      program.uniforms.iResolution.value.b = w / h;
    }
    window.addEventListener("resize", resize);
    resize();

    function update(t: number) {
      const timeSeconds = t * 0.001;
      program.uniforms.iTime.value = timeSeconds;
      program.uniforms.uPulse.value = computeHeartbeat(timeSeconds);

      renderer.render({ scene: mesh });
      animationFrameId.current = requestAnimationFrame(update);
    }
    animationFrameId.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameId.current)
        cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener("resize", resize);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [color, enableMouseInteraction]);

  return <div ref={containerRef} className="threads-container" {...rest} />;
}
