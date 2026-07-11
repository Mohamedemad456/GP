using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs.Auth
{
    public class ChangePasswordDto
    {
        public required string OldPassword { get; set; }
        public required string NewPassword { get; set; }
        public required string ConfirmPassword { get; set; }
    }
}
