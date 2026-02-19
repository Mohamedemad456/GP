using System;

namespace Karna.Core.Application.Abstraction.DTOs.Auth
{
    public class RegisterDto
    {
        public required string Name { get; set; }
        
        public required string Email { get; set; }

        public string? WhatsAppNumber { get; set; }

        public required string Password { get; set; }

        public required string ConfirmPassword { get; set; }

    }
}
