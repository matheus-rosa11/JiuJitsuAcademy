using JiuJitsu.Api.DTOs;
using JiuJitsu.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JiuJitsu.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("register")]
    public Task<AuthResponse> Register(RegisterRequest request) => auth.RegisterAsync(request);

    [AllowAnonymous]
    [HttpPost("login")]
    public Task<AuthResponse> Login(LoginRequest request) => auth.LoginAsync(request);

    [HttpGet("me")]
    public Task<AuthResponse> Me() => auth.MeAsync(Actor.From(User));
}
