// Vertex shader for the cosmic audio sphere
export const cosmicSphereVertexShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeatIntensity;
  uniform float uDistortion;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  varying float vElevation;

  // Simplex 3D Noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Fractal Brownian Motion for more organic noise
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 4; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Create organic noise displacement
    float slowTime = uTime * 0.3;
    float fastTime = uTime * 1.5;

    // Base noise - slow, flowing movement
    float noise1 = fbm(position * 2.0 + slowTime);

    // Detail noise - faster, smaller details
    float noise2 = snoise(position * 4.0 + fastTime) * 0.5;

    // Audio-reactive noise - responds to frequencies
    float bassNoise = snoise(position * 1.5 + uTime * 0.5) * uBass * 2.0;
    float trebleNoise = snoise(position * 8.0 + uTime * 2.0) * uTreble * 0.5;

    // Combine noises
    float totalNoise = noise1 + noise2 + bassNoise + trebleNoise;

    // Calculate displacement based on audio
    float baseDisplacement = totalNoise * uDistortion;
    float audioDisplacement = (uBass * 0.4 + uMid * 0.3 + uTreble * 0.2) * uEnergy;
    float beatPulse = uBeatIntensity * 0.3;

    float displacement = baseDisplacement + audioDisplacement + beatPulse;

    // Apply displacement along normal
    vec3 newPosition = position + normal * displacement;

    // Pass data to fragment shader
    vPosition = newPosition;
    vDisplacement = displacement;
    vElevation = (position.y + 1.0) / 2.0; // 0 at bottom, 1 at top

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

// Fragment shader for the cosmic audio sphere
export const cosmicSphereFragmentShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeatIntensity;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  varying float vElevation;

  void main() {
    // Calculate fresnel for edge glow
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.5);

    // Color mixing based on audio and position
    float colorMix1 = sin(vElevation * 3.14159 + uTime * 0.5) * 0.5 + 0.5;
    float colorMix2 = cos(vDisplacement * 5.0 + uTime) * 0.5 + 0.5;

    // Audio influences color
    vec3 bassColor = uColor1 * (1.0 + uBass * 0.5);
    vec3 midColor = uColor2 * (1.0 + uMid * 0.3);
    vec3 trebleColor = uColor3 * (1.0 + uTreble * 0.4);

    // Blend colors
    vec3 color = mix(bassColor, midColor, colorMix1);
    color = mix(color, trebleColor, colorMix2 * 0.5);

    // Add energy-based brightness
    color *= 1.0 + uEnergy * 0.5;

    // Beat flash
    color += vec3(1.0) * uBeatIntensity * 0.3;

    // Apply fresnel glow
    color += fresnel * mix(uColor1, uColor3, 0.5) * (0.5 + uEnergy);

    // Core glow intensity based on displacement
    float coreGlow = smoothstep(0.0, 0.5, abs(vDisplacement)) * 0.3;
    color += coreGlow * uColor2;

    // Alpha based on energy and fresnel
    float alpha = uOpacity * (0.7 + fresnel * 0.3 + uEnergy * 0.2);

    gl_FragColor = vec4(color, alpha);
  }
`

// Inner glow sphere shaders
export const innerGlowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const innerGlowFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uEnergy;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Inverse fresnel for inner glow (bright center, fading edges)
    vec3 viewDirection = normalize(-vPosition);
    float fresnel = pow(dot(viewDirection, vNormal), 1.5);

    vec3 color = uColor * uIntensity * (1.0 + uEnergy * 0.5);
    float alpha = fresnel * (0.3 + uEnergy * 0.2);

    gl_FragColor = vec4(color, alpha);
  }
`
