module.exports = {
  apps: [
    {
      name: "main",
      cwd: "./apps/main",
      script: "npm",
      args: "run start:main",
      env: {
        PORT: 3001
      }
    },
    {
      name: "profile",
      cwd: "./apps/profile",
      script: "npm",
      args: "run start:profile",
      env: {
        PORT: 3002
      }
    },
    {
      name: "brain",
      cwd: "./apps/brain",
      script: "npm",
      args: "run start:brain",
      env: {
        PORT: 3003
      }
    },
    {
      name: "writer",
      cwd: "./apps/writer",
      script: "npm",
      args: "run start:writer",
      env: {
        PORT: 3004
      }
    },
    
  ]
};
