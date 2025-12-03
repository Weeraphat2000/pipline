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

# Enable ingress (optional)
minikube addons enable ingress
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

**For Minikube:**

```bash
# Get the URL
minikube service pipeline-app-service --url

# Or use tunnel for LoadBalancer services
minikube tunnel
```

**For Docker Desktop:**

```bash
# Access via NodePort
open http://localhost:30000
```

---

## Useful Commands

```bash
# View all resources
kubectl get all

# View pod logs
kubectl logs -f deployment/pipeline-app

# Describe pod for debugging
kubectl describe pod -l app=pipeline-app

# Delete all resources
kubectl delete -f k8s/local/

# Restart deployment
kubectl rollout restart deployment/pipeline-app

# Scale deployment
kubectl scale deployment/pipeline-app --replicas=3

# Port forward (alternative access method)
kubectl port-forward service/pipeline-app-service 3000:80
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

### Reset Everything

```bash
# Delete and recreate
kubectl delete -f k8s/local/
kubectl apply -f k8s/local/
```
