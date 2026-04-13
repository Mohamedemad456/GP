using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.Makes;
using Karna.Core.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Karna.Core.Application.Services
{
	internal class MakeService(
		IUnitOfWork _unitOfWork,
		ILocalizationService _localizer,
		IFileService _fileService,
		IConfiguration _configuration,
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
				return new ApiResponse<MakeDto> { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			return new ApiResponse<MakeDto> { Success = true, Data = make.ToDto(_configuration) };
		}

		public async Task<ApiResponse<Pagination<MakeDto>>> GetAllAsync(MakeSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<Make>();

			var dataSpec = new MakeListSpecification(specParams, activeOnly: false, applyPaging: true);
			var countSpec = new MakeListSpecification(specParams, activeOnly: false, applyPaging: false);

			var makes = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<MakeDto>>
			{
				Success = true,
				Data = new Pagination<MakeDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = makes.ToDto(_configuration)
				}
			};
		}

		public async Task<ApiResponse<Pagination<MakeDto>>> GetAllActiveAsync(PaginationSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<Make>();

			var makeSpecParams = new MakeSpecParams
			{
				PageIndex = specParams.PageIndex,
				PageSize = specParams.PageSize,
				Search = specParams.Search,
				Sort = specParams.Sort,
				SortDirection = specParams.SortDirection,
				IsActive = true
			};

			var dataSpec = new MakeListSpecification(makeSpecParams, activeOnly: true, applyPaging: true);
			var countSpec = new MakeListSpecification(makeSpecParams, activeOnly: true, applyPaging: false);

			var makes = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<MakeDto>>
			{
				Success = true,
				Data = new Pagination<MakeDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = makes.ToDto(_configuration)
				}
			};
		}

		public async Task<ApiResponse<MakeDto>> CreateAsync(CreateMakeDto dto)
		{
			var validationResult = await _createValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<MakeDto> { Success = false, Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage)) };

			var repo = _unitOfWork.GetRepository<Make>();

			var existing = await repo.GetAsync(m => m.Name == dto.Name || m.NameAr == dto.NameAr);
			if (existing is not null)
				return new ApiResponse<MakeDto> { Success = false, Message = _localizer.GetValidationMessage("MakeNameAlreadyExists") };

			var make = dto.ToEntity();

			if (dto.Icon is not null)
				make.LogoUrl = await _fileService.SaveFileAsync(dto.Icon, IconsFolder);

			await repo.AddAsync(make);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<MakeDto>
			{
				Success = true,
				Message = _localizer.GetMessage("MakeCreated"),
				Data = make.ToDto(_configuration)
			};
		}

		public async Task<ApiResponse<MakeDto>> UpdateAsync(Guid id, UpdateMakeDto dto)
		{
			var validationResult = await _updateValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<MakeDto> { Success = false, Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage)) };

			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponse<MakeDto> { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			var duplicate = await repo.GetAsync(m => (m.Name == dto.Name || m.NameAr == dto.NameAr) && m.Id != id);
			if (duplicate is not null)
				return new ApiResponse<MakeDto> { Success = false, Message = _localizer.GetValidationMessage("MakeNameAlreadyExists") };

			if (dto.Icon is not null)
			{
				if (!string.IsNullOrEmpty(make.LogoUrl))
					_fileService.DeleteFile(make.LogoUrl);

				make.LogoUrl = await _fileService.SaveFileAsync(dto.Icon, IconsFolder);
			}

			dto.ApplyTo(make);

			repo.Update(make);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<MakeDto>
			{
				Success = true,
				Message = _localizer.GetMessage("MakeUpdated"),
				Data = make.ToDto(_configuration)
			};
		}

		public async Task<ApiResponseDto> ActivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponseDto { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			if (!make.IsActive)
			{
				make.IsActive = true;
				repo.Update(make);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto { Success = true, Message = _localizer.GetMessage("MakeActivated") };
		}

		public async Task<ApiResponseDto> DeactivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponseDto { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			if (make.IsActive)
			{
				make.IsActive = false;
				repo.Update(make);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto { Success = true, Message = _localizer.GetMessage("MakeDeactivated") };
		}

		public async Task<ApiResponseDto> DeleteAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Make>();
			var make = await repo.GetAsync(id);

			if (make is null)
				return new ApiResponseDto { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			if (!string.IsNullOrEmpty(make.LogoUrl))
				_fileService.DeleteFile(make.LogoUrl);

			repo.Delete(make);
			await _unitOfWork.CompleteAsync();

			return new ApiResponseDto { Success = true, Message = _localizer.GetMessage("MakeDeleted") };
		}
	}
}
