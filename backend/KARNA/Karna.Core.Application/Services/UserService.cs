using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.User;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Exceptions;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class UserService(
		IIdentityService _identityService,
		ICurrentUserService _currentUserService,
		ILocalizationService _localizer,
		IUnitOfWork _unitOfWork,
		IValidator<UpdateProfileDto> _updateProfileValidator
		) : IUserService
	{
		public async Task<ApiResponse<UserDto>> GetProfileAsync()
		{
			var identityUser = await _identityService.FindUserByIdAsync(_currentUserService.UserId);

			if (!identityUser.Found)
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("UserNotFound")
				};

			var domainUser = await _unitOfWork.GetRepository<User>()
				.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);

			if (domainUser is null)
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("UserNotFound")
				};

			return new ApiResponse<UserDto>
			{
				Success = true,
				Data = new UserDto
				{
					UserId = identityUser.UserId,
					Name = domainUser.Name,
					UserName = identityUser.UserName,
					Email = identityUser.Email,
					PhoneNumber = identityUser.PhoneNumber,
					WhatsAppNumber = domainUser.WhatsAppNumber,
					IsActive = identityUser.IsActive,
					CreatedAt = domainUser.CreatedAt,
					Roles = _currentUserService.Roles
				}
			};
		}

		public async Task<ApiResponse<UserDto>> UpdateProfileAsync(UpdateProfileDto dto)
		{
			var validationResult = await _updateProfileValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};

			var identityUser = await _identityService.FindUserByIdAsync(_currentUserService.UserId);
			if (!identityUser.Found)
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("UserNotFound")
				};

			var domainUser = await _unitOfWork.GetRepository<User>()
				.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);

			if (domainUser is null)
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("UserNotFound")
				};

			if (!string.Equals(identityUser.UserName, dto.UserName, StringComparison.OrdinalIgnoreCase))
			{
				var takenBy = await _identityService.FindUserByUsernameAsync(dto.UserName);
				if (takenBy.Found)
					return new ApiResponse<UserDto>
					{
						Success = false,
						Message = _localizer.GetValidationMessage("UsernameAlreadyTaken")
					};
			}

			try
			{
				await _unitOfWork.ExecuteInTransactionAsync(async () =>
				{
					domainUser.Name = dto.Name;
					domainUser.WhatsAppNumber = dto.WhatsAppNumber;
					_unitOfWork.GetRepository<User>().Update(domainUser);
					await _unitOfWork.CompleteAsync();

					var (succeeded, errors) = await _identityService.UpdateUserAsync(
						_currentUserService.UserId,
						dto.UserName,
						dto.PhoneNumber);

					if (!succeeded)
						throw new IdentityOperationException(errors);
				});
			}
			catch (IdentityOperationException ex)
			{
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = string.Join("; ", ex.Errors)
				};
			}
			return new ApiResponse<UserDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ProfileUpdated"),
				Data = new UserDto
				{
					UserId = identityUser.UserId,
					Name = domainUser.Name,
					UserName = dto.UserName,
					Email = identityUser.Email,
					PhoneNumber = dto.PhoneNumber,
					WhatsAppNumber = domainUser.WhatsAppNumber,
					IsActive = identityUser.IsActive,
					CreatedAt = domainUser.CreatedAt,
					Roles = _currentUserService.Roles
				}
			};
		}
	}
}
