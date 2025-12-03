# Local Kubernetes Development

This guide helps you run the application locally using Kubernetes (Minikube or Docker Desktop).

## Prerequisites

Choose one of these options:

### Option 1: Minikube

```bash
# Install Minikube (macOS)
brew install minikube

# Start Minikube
minikube start

# Enable metrics-server for HPA
minikube addons enable metrics-server
```

### Option 2: Docker Desktop

1. Open Docker Desktop
2. Go to Settings → Kubernetes
3. Check "Enable Kubernetes"
4. Click "Apply & Restart"

---

## Quick Start

### Step 1: Build Docker Image

**For Minikube:**

```bash
# Use Minikube's Docker daemon
eval $(minikube docker-env)

# Build the image
docker build -t pipeline-app:local .
```

**For Docker Desktop:**

```bash
# Build the image
docker build -t pipeline-app:local .
```

### Step 2: Deploy to Kubernetes

```bash
# Apply the local manifests
kubectl apply -f k8s/local/

# Check deployment status
kubectl get pods -w
```

### Step 3: Access the Application

Choose one of the following methods:

---

## Service Types

### Option A: LoadBalancer (Default)

The default `service.yaml` uses LoadBalancer type.

**For Minikube:**

```bash
# Run tunnel in a separate terminal (keep it running)
minikube tunnel

# Get external IP
kubectl get svc pipeline-app-service

# Access the app
open http://127.0.0.1
```

**For Docker Desktop:**

```bash
# LoadBalancer works automatically
open http://localhost
```

---

### Option B: NodePort

If you prefer NodePort, update `service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: pipeline-app-service
  labels:
    app: pipeline-app
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 30000
      protocol: TCP
  selector:
    app: pipeline-app
```

Then apply and access:

**For Minikube:**

```bash
kubectl apply -f k8s/local/service.yaml

# Get the URL
minikube service pipeline-app-service --url

# Or access directly
open http://$(minikube ip):30000
```

**For Docker Desktop:**

```bash
kubectl apply -f k8s/local/service.yaml

# Access via NodePort
open http://localhost:30000
```

---

### Option C: Port Forward (Works Anywhere)

This method works regardless of service type:

```bash
# Forward local port 3000 to service port 80
kubectl port-forward service/pipeline-app-service 3000:80

# Access the app
open http://localhost:3000
```

---

## Comparison: LoadBalancer vs NodePort

| Feature         | LoadBalancer               | NodePort                 |
| --------------- | -------------------------- | ------------------------ |
| Port            | 80 (standard)              | 30000-32767              |
| Minikube        | Requires `minikube tunnel` | Works directly           |
| Docker Desktop  | Works automatically        | Works automatically      |
| Production-like | ✅ Yes                     | ❌ No                    |
| URL             | `http://localhost`         | `http://localhost:30000` |

---

## Health Checks (Probes)

Kubernetes uses health checks to monitor pod status and ensure reliable service.

### Probe Types

| Probe              | Question                        | If Fails                      | Use Case                     |
| ------------------ | ------------------------------- | ----------------------------- | ---------------------------- |
| **livenessProbe**  | "Is the app still alive?"       | **Restart** the pod           | Detect deadlocks, frozen app |
| **readinessProbe** | "Is the app ready for traffic?" | **Remove** from load balancer | App starting, waiting for DB |

### How It Works

```
Pod Lifecycle:

1. Pod starts
2. Wait 5s → readinessProbe checks /health every 5s
   ✅ Pass → Pod added to Service (receives traffic)
   ❌ Fail → Pod removed from Service (no traffic)

3. Wait 30s → livenessProbe checks /health every 10s
   ✅ Pass → Pod keeps running
   ❌ Fail → Pod gets restarted
```

### Current Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30 # Wait 30s before first check
  periodSeconds: 10 # Check every 10s

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5 # Wait 5s before first check
  periodSeconds: 5 # Check every 5s
```

### Check Probe Status

```bash
# View probe status in pod description
kubectl describe pod -l app=pipeline-app

# Look for:
# - Liveness: http-get http://:3000/health
# - Readiness: http-get http://:3000/health

# Test health endpoint directly
kubectl exec -it deployment/pipeline-app -- curl localhost:3000/health
```

### Common Probe Issues

| Issue                     | Symptom                     | Solution                             |
| ------------------------- | --------------------------- | ------------------------------------ |
| App slow to start         | Pod restarts during startup | Increase `initialDelaySeconds`       |
| Frequent restarts         | livenessProbe failing       | Check logs, increase `periodSeconds` |
| Pod not receiving traffic | readinessProbe failing      | Check `/health` endpoint             |

---

## Horizontal Pod Autoscaler (HPA)

HPA automatically scales the number of pods based on CPU and memory usage.

### How HPA Works

```
                    HPA Monitoring Loop (every 15s)
                              │
                              ▼
                    ┌──────────────────┐
                    │  Check Metrics   │
                    │  CPU / Memory    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         < Target       = Target       > Target
         (< 70%)        (≈ 70%)        (> 70%)
              │              │              │
              ▼              ▼              ▼
         Scale DOWN     Do Nothing     Scale UP
         (min: 1)                      (max: 5)
```

### Current Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70 # Scale up if CPU > 70%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80 # Scale up if Memory > 80%
```

### Prerequisites: Enable Metrics Server

HPA requires metrics-server to read CPU/memory data.

**For Minikube:**

```bash
minikube addons enable metrics-server
```

**For Docker Desktop:**

```bash
# Install metrics-server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Patch for Docker Desktop (skip TLS verification)
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
```

### Verify Metrics Server

```bash
# Check metrics-server is running
kubectl get pods -n kube-system | grep metrics-server

# Test pod metrics (wait 1-2 min after installing)
kubectl top pods
```

### Monitor HPA

```bash
# Check HPA status
kubectl get hpa

# Expected output (with metrics working):
# NAME               TARGETS                          MINPODS   MAXPODS   REPLICAS
# pipeline-app-hpa   cpu: 50%/70%, memory: 40%/80%    1         5         2

# If you see <unknown>, metrics-server is not working
# NAME               TARGETS                                    MINPODS   MAXPODS   REPLICAS
# pipeline-app-hpa   cpu: <unknown>/70%, memory: <unknown>/80%  1         5         1
```

### Test HPA Scaling

**Step 1: Watch HPA in one terminal**

```bash
# Using watch (install: brew install watch)
watch -n 1 kubectl get hpa,pods

# Or using a loop
while true; do clear; kubectl get hpa,pods; sleep 1; done
```

**Step 2: Generate load in another terminal**

```bash
# Using hey (install: brew install hey)
hey -z 60s -c 50 http://localhost/

# Or using curl loop
while true; do curl -s http://localhost > /dev/null; done
```

**Step 3: Observe scaling**

```
Before load:
REPLICAS: 1

During load (CPU/Memory > threshold):
REPLICAS: 1 → 2 → 3 → 4 → 5

After load stops (5 min cooldown):
REPLICAS: 5 → 3 → 1
```

### HPA Behavior

| Metric                     | Threshold    | Action                   |
| -------------------------- | ------------ | ------------------------ |
| CPU < 70% AND Memory < 80% | Below target | Scale DOWN (after 5 min) |
| CPU ≈ 70% AND Memory ≈ 80% | At target    | No change                |
| CPU > 70% OR Memory > 80%  | Above target | Scale UP (immediate)     |

### Tips for Testing

Use **lower resource requests** to see HPA scale faster:

```yaml
resources:
  requests:
    memory: '32Mi' # Low = hits threshold quickly
    cpu: '10m'
```

### Common HPA Issues

| Issue               | Symptom                   | Solution                                 |
| ------------------- | ------------------------- | ---------------------------------------- |
| `<unknown>` metrics | HPA can't read CPU/memory | Install metrics-server                   |
| Not scaling up      | Metrics below threshold   | Lower resource requests or increase load |
| Not scaling down    | Stuck at max replicas     | Wait 5 min cooldown period               |
| Slow scaling        | Takes too long            | HPA checks every 15s by default          |

---

## Useful Commands

```bash
# View all resources
kubectl get all

# View pod logs
kubectl logs -f deployment/pipeline-app

# Check CPU and memory usage
kubectl top pods

# Check HPA status
kubectl get hpa

# Describe pod for debugging
kubectl describe pod -l app=pipeline-app

# Delete all resources
kubectl delete -f k8s/local/

# Restart deployment
kubectl rollout restart deployment/pipeline-app

# Scale deployment
kubectl scale deployment/pipeline-app --replicas=3
```

---

## Troubleshooting

### Image Pull Error

If you see `ErrImagePull` or `ImagePullBackOff`:

```bash
# Make sure imagePullPolicy is set to Never
# And that you built the image in the correct Docker context

# For Minikube, ensure you're using Minikube's Docker:
eval $(minikube docker-env)
docker build -t pipeline-app:local .
```

### Pod CrashLoopBackOff

```bash
# Check logs
kubectl logs -f deployment/pipeline-app

# Check events
kubectl describe pod -l app=pipeline-app
```

### LoadBalancer Pending (Minikube)

If external IP shows `<pending>`:

```bash
# Run minikube tunnel in a separate terminal
minikube tunnel
```

### HPA Shows Unknown Metrics

```bash
# Enable metrics-server
minikube addons enable metrics-server

# Wait a minute, then check again
kubectl get hpa
```

### Reset Everything

```bash
# Delete and recreate
kubectl delete -f k8s/local/
kubectl apply -f k8s/local/
```

---

## Namespace Management

Kubernetes uses namespaces to isolate resources.

### View All Namespaces

```bash
kubectl get namespaces
```

### Default Namespaces

| Namespace           | Description                      | ลบได้ไหม |
| ------------------- | -------------------------------- | -------- |
| **default**         | namespace หลักสำหรับ app ของคุณ  | ❌       |
| **kube-system**     | system components (DNS, metrics) | ❌       |
| **kube-public**     | public cluster info              | ❌       |
| **kube-node-lease** | node heartbeat management        | ❌       |

### View Resources in All Namespaces

```bash
# View all services
kubectl get svc --all-namespaces

# View all pods
kubectl get pods --all-namespaces

# View all resources
kubectl get all --all-namespaces
```

### Delete a Namespace

```bash
# Normal delete
kubectl delete namespace <namespace-name>

# Force delete (if stuck in Terminating)
kubectl delete namespace <namespace-name> --force --grace-period=0
```

### Fix Namespace Stuck in "Terminating"

If a namespace is stuck in `Terminating` status:

```bash
# Check what's blocking it
kubectl get all -n <namespace-name>

# Remove finalizers to force delete
kubectl get namespace <namespace-name> -o json | \
  jq '.spec.finalizers = []' | \
  kubectl replace --raw "/api/v1/namespaces/<namespace-name>/finalize" -f -
```

### Create a New Namespace

```bash
# Create namespace
kubectl create namespace my-app

# Deploy to specific namespace
kubectl apply -f k8s/local/ -n my-app

# Set default namespace
kubectl config set-context --current --namespace=my-app
```

---

## Context Management

Kubernetes uses contexts to switch between clusters and namespaces.

### View Current Context

```bash
# Show all contexts
kubectl config get-contexts

# Show current context only
kubectl config current-context
```

### Example Output

```
CURRENT   NAME             CLUSTER          AUTHINFO         NAMESPACE
*         docker-desktop   docker-desktop   docker-desktop
          gke_my-project   gke_my-project   gke_my-project   production
```

- `*` = context ที่กำลังใช้งานอยู่
- `NAMESPACE` = namespace เริ่มต้น (ถ้าว่าง = default)

### Switch Context (Cluster)

```bash
# เปลี่ยนไปใช้ cluster อื่น
kubectl config use-context docker-desktop

# เปลี่ยนไปใช้ GKE cluster
kubectl config use-context gke_my-project_asia-southeast1_my-cluster
```

### Change Default Namespace

```bash
# เปลี่ยน namespace เริ่มต้นสำหรับ context ปัจจุบัน
kubectl config set-context --current --namespace=my-app

# เปลี่ยนกลับไปใช้ default
kubectl config set-context --current --namespace=default
```

### View Current Config

```bash
# ดูค่า config ทั้งหมด
kubectl config view

# ดูเฉพาะ current context
kubectl config view --minify
```

### Common Context Workflows

**Switch between Local and Production:**

```bash
# ทำงานกับ local (Docker Desktop)
kubectl config use-context docker-desktop

# Deploy to production (GKE/EKS)
kubectl config use-context gke_my-project_asia-southeast1_production
```

**Work with Multiple Namespaces:**

```bash
# สร้างและใช้ namespace สำหรับ development
kubectl create namespace dev
kubectl config set-context --current --namespace=dev
kubectl apply -f k8s/local/

# สลับไปใช้ staging
kubectl config set-context --current --namespace=staging
```

### Tips

| คำสั่ง                                                  | คำอธิบาย            |
| ------------------------------------------------------- | ------------------- |
| `kubectl config get-contexts`                           | ดู contexts ทั้งหมด |
| `kubectl config current-context`                        | ดู context ปัจจุบัน |
| `kubectl config use-context <name>`                     | เปลี่ยน cluster     |
| `kubectl config set-context --current --namespace=<ns>` | เปลี่ยน namespace   |
