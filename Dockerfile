# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o freectl

# Final stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/freectl .

# Create necessary directories
RUN mkdir -p /root/.local/cache/freectl /root/.config/freectl

# Expose the default port
EXPOSE 8080

# Set environment variables
ENV HOME=/root

# Run the application
CMD ["./freectl", "serve", "--port", "8080"]