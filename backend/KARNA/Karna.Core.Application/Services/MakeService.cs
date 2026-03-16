using AutoMapper;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Specifications.Makes;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class MakeService(
		IUnitOfWork _unitOfWork,
		IMapper _mapper,
		ILocalizationService _localizer,
		IFileService _fileService,
		IValidator<CreateMakeDto> _createValidator,
		IValidator<UpdateMakeDto> _updateValidator
		) : IMakeService
	{
		private const string IconsFolder = "icons/Makes";

		public async Task<ApiResponse<MakeDto>> GetByIdAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponse<MakeDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("MakeNotFound")
				};

			return new ApiResponse<MakeDto>
			{
				Success = true,
				Data = _mapper.Map<MakeDto>(make)
			};
		}

		public async Task<ApiResponse<IEnumerable<MakeDto>>> GetAllAsync()
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var makes = await repo.GetAllAsync();

			return new ApiResponse<IEnumerable<MakeDto>>
			{
				Success = true,
				Data = _mapper.Map<IEnumerable<MakeDto>>(makes)
			};
		}

		public async Task<ApiResponse<IEnumerable<MakeDto>>> GetAllActiveAsync()
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var spec = new ActiveMakesSpec();
			var activeMakes = await repo.GetAllWithSpecAsync(spec);

			return new ApiResponse<IEnumerable<MakeDto>>
			{
				Success = true,
				Data = _mapper.Map<IEnumerable<MakeDto>>(activeMakes)
			};
		}

		public async Task<ApiResponse<MakeDto>> CreateAsync(CreateMakeDto dto)
		{
			var validationResult = await _createValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<MakeDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};

			var repo = _unitOfWork.GetRepository<Make>();

			var existing = await repo.GetAsync(m => m.Name == dto.Name || m.NameAr == dto.NameAr);
			if (existing is not null)
				return new ApiResponse<MakeDto>
				{
					Success = false,
					Message = _localizer.GetValidationMessage("MakeNameAlreadyExists")
				};

			var make = _mapper.Map<Make>(dto);

			if (dto.Icon is not null)
				make.LogoUrl = await _fileService.SaveFileAsync(dto.Icon, IconsFolder);

			await repo.AddAsync(make);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<MakeDto>
			{
				Success = true,
				Message = _localizer.GetMessage("MakeCreated"),
				Data = _mapper.Map<MakeDto>(make)
			};
		}

		public async Task<ApiResponse<MakeDto>> UpdateAsync(Guid id, UpdateMakeDto dto)
		{
			var validationResult = await _updateValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<MakeDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};

			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponse<MakeDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("MakeNotFound")
				};

			var duplicate = await repo.GetAsync(m =>
				(m.Name == dto.Name || m.NameAr == dto.NameAr) && m.Id != id);
			if (duplicate is not null)
				return new ApiResponse<MakeDto>
				{
					Success = false,
					Message = _localizer.GetValidationMessage("MakeNameAlreadyExists")
				};

			if (dto.Icon is not null)
			{
				if (!string.IsNullOrEmpty(make.LogoUrl))
					_fileService.DeleteFile(make.LogoUrl);

				make.LogoUrl = await _fileService.SaveFileAsync(dto.Icon, IconsFolder);
			}

			_mapper.Map(dto, make);

			repo.Update(make);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<MakeDto>
			{
				Success = true,
				Message = _localizer.GetMessage("MakeUpdated"),
				Data = _mapper.Map<MakeDto>(make)
			};
		}

		public async Task<ApiResponseDto> ActivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponseDto
				{
					Success = false,
					Message = _localizer.GetErrorMessage("MakeNotFound")
				};

			if (!make.IsActive)
			{
				make.IsActive = true;
				repo.Update(make);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("MakeActivated")
			};
		}

		public async Task<ApiResponseDto> DeactivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponseDto
				{
					Success = false,
					Message = _localizer.GetErrorMessage("MakeNotFound")
				};

			if (make.IsActive)
			{
				make.IsActive = false;
				repo.Update(make);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("MakeDeactivated")
			};
		}

		public async Task<ApiResponseDto> DeleteAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponseDto
				{
					Success = false,
					Message = _localizer.GetErrorMessage("MakeNotFound")
				};

			if (!string.IsNullOrEmpty(make.LogoUrl))
				_fileService.DeleteFile(make.LogoUrl);

			repo.Delete(make);
			await _unitOfWork.CompleteAsync();

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("MakeDeleted")
			};
		}
	}
}
